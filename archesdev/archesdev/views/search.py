'''
ARCHES - a program developed to inventory and manage immovable cultural heritage.
Copyright (C) 2013 J. Paul Getty Trust and World Monuments Fund

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
'''
import json
from datetime import datetime
from django.conf import settings
from django.template import RequestContext
from django.shortcuts import render_to_response
from django.db.models import Max, Min
from arches.app.models import models
from arches.app.views.search import get_paginator
from arches.app.views.search import _get_child_concepts
from arches.app.views.search import build_search_results_dsl as build_base_search_results_dsl
from arches.app.models.concept import Concept
from arches.app.utils.betterJSONSerializer import JSONSerializer, JSONDeserializer
from arches.app.search.search_engine_factory import SearchEngineFactory
from arches.app.search.elasticsearch_dsl_builder import Bool, Match, Query, Nested, Terms, GeoShape, Range
from django.utils.translation import ugettext as _

from archesdev.utils.date_utils import get_year_from_int,date_to_int

def home_page(request):

    lang = request.GET.get('lang', settings.LANGUAGE_CODE)
    min_max_dates = get_min_max_extended_dates()
    
    return render_to_response('search.htm', {
            'main_script': 'search',
            'active_page': 'Search',
            'min_date': min_max_dates['val__min'] if min_max_dates['val__min'] != None else 0,
            'max_date': min_max_dates['val__max'] if min_max_dates['val__min'] != None else 1,
            'timefilterdata': JSONSerializer().serialize(Concept.get_time_filter_data())
        }, 
        context_instance=RequestContext(request))
        
def get_min_max_extended_dates():

    se = SearchEngineFactory().create()

    query = Query(se)
    aggs = {
        "extendeddates": {
            "nested": {
                "path": "extendeddates"
            },
            "aggs": {
                "min_date": {
                    "min": {
                        "field": "extendeddates.value"
                    }
                },
                "max_date": {
                    "max": {
                       "field": "extendeddates.value"
                    }
                }
            }
        }
    }
    
    query._dsl['aggs'] = aggs
    results = query.search(index='entity', doc_type='')
    
    if not results:
        return {'val__min':None,'val__max':None}

    min_date = results['aggregations']['extendeddates']['min_date']['value']
    max_date = results['aggregations']['extendeddates']['max_date']['value']
    
    minyear = get_year_from_int(min_date)
    maxyear = get_year_from_int(max_date)
    
    min_max_date = {'val__min':minyear,'val__max':maxyear}
    
    return min_max_date


def build_search_results_dsl(request):
    term_filter = request.GET.get('termFilter', '')
    spatial_filter = JSONDeserializer().deserialize(request.GET.get('spatialFilter', None)) 
    export = request.GET.get('export', None)
    page = 1 if request.GET.get('page') == '' else int(request.GET.get('page', 1))
    temporal_filter = JSONDeserializer().deserialize(request.GET.get('temporalFilter', None))

    se = SearchEngineFactory().create()

    if export != None:
        limit = settings.SEARCH_EXPORT_ITEMS_PER_PAGE  
    else:
        limit = settings.SEARCH_ITEMS_PER_PAGE
    
    query = Query(se, start=limit*int(page-1), limit=limit)
    boolquery = Bool()
    boolfilter = Bool()
    
    if term_filter != '':
        for term in JSONDeserializer().deserialize(term_filter):
            if term['type'] == 'term':
                entitytype = models.EntityTypes.objects.get(conceptid_id=term['context'])
                boolfilter_nested = Bool()
                boolfilter_nested.must(Terms(field='child_entities.entitytypeid', terms=[entitytype.pk]))
                boolfilter_nested.must(Match(field='child_entities.value', query=term['value'], type='phrase'))
                nested = Nested(path='child_entities', query=boolfilter_nested)
                if term['inverted']:
                    boolfilter.must_not(nested)
                else:    
                    boolfilter.must(nested)
            elif term['type'] == 'concept':
                concept_ids = _get_child_concepts(term['value'])
                terms = Terms(field='domains.conceptid', terms=concept_ids)
                nested = Nested(path='domains', query=terms)
                if term['inverted']:
                    boolfilter.must_not(nested)
                else:
                    boolfilter.must(nested)
            elif term['type'] == 'string':
                boolfilter_folded = Bool()
                boolfilter_folded.should(Match(field='child_entities.value', query=term['value'], type='phrase_prefix'))
                boolfilter_folded.should(Match(field='child_entities.value.folded', query=term['value'], type='phrase_prefix'))
                nested = Nested(path='child_entities', query=boolfilter_folded)
                if term['inverted']:
                    boolquery.must_not(nested)
                else:    
                    boolquery.must(nested)

    if 'geometry' in spatial_filter and 'type' in spatial_filter['geometry'] and spatial_filter['geometry']['type'] != '':
        geojson = spatial_filter['geometry']
        if geojson['type'] == 'bbox':
            coordinates = [[geojson['coordinates'][0],geojson['coordinates'][3]], [geojson['coordinates'][2],geojson['coordinates'][1]]]
            geoshape = GeoShape(field='geometries.value', type='envelope', coordinates=coordinates )
            nested = Nested(path='geometries', query=geoshape)
        else:
            buffer = spatial_filter['buffer']
            geojson = JSONDeserializer().deserialize(_buffer(geojson,buffer['width'],buffer['unit']).json)
            geoshape = GeoShape(field='geometries.value', type=geojson['type'], coordinates=geojson['coordinates'] )
            nested = Nested(path='geometries', query=geoshape)

        if 'inverted' not in spatial_filter:
            spatial_filter['inverted'] = False

        if spatial_filter['inverted']:
            boolfilter.must_not(nested)
        else:
            boolfilter.must(nested)

    if 'year_min_max' in temporal_filter and len(temporal_filter['year_min_max']) == 2:
        start = temporal_filter['year_min_max'][0]*10000
        end = temporal_filter['year_min_max'][1]*10000
        range = Range(field='extendeddates.value', gte=start, lte=end)
        nested = Nested(path='extendeddates', query=range)
        
        if 'inverted' not in temporal_filter:
            temporal_filter['inverted'] = False

        if temporal_filter['inverted']:
            boolfilter.must_not(nested)
        else:
            boolfilter.must(nested)

    if 'filters' in temporal_filter:
        time_boolfilter = Bool()
        for temporal_filter in temporal_filter['filters']:
            date_type = ''
            date = ''
            date_operator = ''
            for node in temporal_filter['nodes']:
                if node['entitytypeid'] == 'DATE_COMPARISON_OPERATOR.E55':
                    date_operator = node['value']
                elif node['entitytypeid'] == 'date':
                    date = node['value']
                else:
                    date_type = node['value']

            terms = Terms(field='extendeddategroups.conceptid', terms=date_type)
            boolfilter.must(terms)

            date_value = date_to_int(date)

            if date_operator == '1': # equals query
                range = Range(field='extendeddategroups.value', gte=date_value, lte=date_value)
            elif date_operator == '0': # greater than query 
                range = Range(field='extendeddategroups.value', lt=date_value)
            elif date_operator == '2': # less than query
                range = Range(field='extendeddategroups.value', gt=date_value)

            if 'inverted' not in temporal_filter:
                temporal_filter['inverted'] = False

            if temporal_filter['inverted']:
                boolfilter.must_not(range)
            else:
                boolfilter.must(range)

    if not boolquery.empty:
        query.add_query(boolquery)

    if not boolfilter.empty:
        query.add_filter(boolfilter)
        
    return query
    
def search_results(request):

    query = build_search_results_dsl(request)
    print query
    results = query.search(index='entity', doc_type='')
    total = results['hits']['total']
    page = 1 if request.GET.get('page') == '' else int(request.GET.get('page', 1))

    all_entity_ids = ['_all']
    if request.GET.get('include_ids', 'false') == 'false':
        all_entity_ids = ['_none']
    elif request.GET.get('no_filters', '') == '':
        full_results = query.search(index='entity', doc_type='', start=0, limit=1000000, fields=[])
        all_entity_ids = [hit['_id'] for hit in full_results['hits']['hits']]

    return get_paginator(results, total, page, settings.SEARCH_ITEMS_PER_PAGE, all_entity_ids)