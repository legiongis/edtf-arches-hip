define([
    'jquery', 
    'backbone', 
    'underscore',
    'arches',
    'edtfy',
    'moment',
    ], function ($, Backbone, _, arches, edtfy, moment) {
    edtfy.locale('en')
    return Backbone.View.extend({
        
        validateDate: function(nodes, node_name){
            var valid = true
            _.each(nodes, function(node){
                if (node["entitytypeid"] == node_name) {
                    if (node.value == '') { return valid};
                    valid = moment(node.value, "YYYY-MM-DD", true).isValid();
                }
            });
            return valid;
        },
        
        validateDateEdtfy: function(nodes,node_name){

            /* set which moment.js formats you will accept here */
            
            var formats = ["YYYY-MM-DD", "YYYY-MM", "Y"]; 
            var valid = nodes !== undefined && nodes.length > 0;
            _.each(nodes, function(node) {
                if (node.entitytypeid != node_name) { return };

                if (node.value.length != node.value.trim().length) {
                    $("#edtf-date-alert").text("Please check for spaces before or after your date.");
                    valid = false;
                    return;
                }

                // first strip out a negative sign if necessary
                // this is just temporary for validation, the node is not actually altered.
                var nodeVal = node.value;
                if( nodeVal.charAt( 0 ) === '-' ) {
                    nodeVal = nodeVal.slice( 1 );
                }
                
                /* use moment.js to check for a correct date format first */
                var initial = moment(nodeVal, formats, true).isValid();
                console.log(moment(nodeVal));
                if (initial === true) {
                    valid = true;
                    return
                }
                console.log("moment failed, now checking with edtfy...");
                /* nodeVal is not strictly valid as a date, so check if it fits edtf */	

                try {
                    var parsed = edtfy(nodeVal); 
                    if(parsed == nodeVal) {
                        /* user entered a correct edtf value */
                        valid = true;
                    } else if(nodeVal.slice(-1) == '~' || 
                              nodeVal.slice(-1) == '?' ||
                              nodeVal.slice(-1) == 'u') {
                        /* check if parser is mis-interpreting YYYY-MM[?] */
                        console.log('yes');
                        var res = nodeVal.substring(0, nodeVal.length-1);
                        var initial = moment(res, formats, true).isValid();
                        if (initial === true) {
                            valid = true;
                        } 								
                    } else {
                        /* user used a recognizable invalid format, suggest edit */
                        $("#edtf-date-alert").text('Try entering this instead: ' + parsed);
                        valid = false;
                    }
                }
                catch(err) {
                    /* check if parser is mis-interpreting YYYY-MM-DD[?] */	  
                    if(nodeVal.slice(-1) == '~' || 
                       nodeVal.slice(-1) == '?' ||
                       nodeVal.slice(-1) == 'u') {
                        var res = nodeVal.substring(0, nodeVal.length-1);
                        var initial = moment(res, formats, true).isValid();
                        if (initial === true) {
                            valid = true;
                        } else {
                            valid = false;
                        }	 
                    } else {
                        /* user entered something incorrect that parser didn't recognize */
                        valid = false;
                    }
                }
            }, this);
            return valid;
        },
        
        // keep original for the time being -AC 2018-06-26
        validateEdtfy: function(nodes){
            /* set which moment.js formats you will accept here */
            var formats = ["YYYY-MM-DD", "YYYY-MM", "Y"]; 
            var valid = nodes !== undefined && nodes.length > 0;
            _.each(nodes, function(node) {
                if (node.entityid === '' && node.value === '') {
                    valid = false;
                } else {
                    /* if this is an interval, allow for current use */
                    if (node.entitytypeid == 'TO_DATE.E49' && node.value == 'open') {
                        valid = true;
                    } else {
                        /* if the value is a cidoc E49, validate further */
                        var entityid = node.entitytypeid.slice(-3);
                        if (entityid == 'E49') {			
                            /* check for leading or trailing white spaces */
                            if (node.value.length != node.value.trim().length) {
                                $("#edtf-date-alert").text('Please check for spaces before or after your date.')
                                valid = false;
                            } else {						
                                /* use moment.js to check for a correct date format first */
                                var initial = moment(node.value, formats, true).isValid();
                                if (initial === true) {
                                    valid = true;
                                } else {
                                    /* node.value is not strictly valid as a date, so check if it fits edtf */	

                                    try {
                                        var parsed = edtfy(node.value); 
                                        if(parsed == node.value) {
                                            /* user entered a correct edtf value */
                                            valid = true;
                                        } else if(node.value.slice(-1) == '~' || 
                                                  node.value.slice(-1) == '?' ||
                                                  node.value.slice(-1) == 'u') {
                                            /* check if parser is mis-interpreting YYYY-MM[?] */
                                            console.log('yes');
                                            var res = node.value.substring(0, node.value.length-1);
                                            var initial = moment(res, formats, true).isValid();
                                            if (initial === true) {
                                                valid = true;
                                            } 								
                                        } else {
                                            /* user used a recognizable invalid format, suggest edit */
                                            $("#edtf-date-alert").text('Try entering this instead: ' + parsed);
                                            valid = false;
                                        }
                                    }
                                    catch(err) {
                                        /* check if parser is mis-interpreting YYYY-MM-DD[?] */	  
                                        if(node.value.slice(-1) == '~' || 
                                           node.value.slice(-1) == '?' ||
                                           node.value.slice(-1) == 'u') {
                                            var res = node.value.substring(0, node.value.length-1);
                                            var initial = moment(res, formats, true).isValid();
                                            if (initial === true) {
                                                valid = true;
                                            } else {
                                                valid = false;
                                            }	 
                                        } else {
                                            /* user entered something incorrect that parser didn't recognize */
                                            valid = false;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }, this);
            return valid;
        }
    });
});