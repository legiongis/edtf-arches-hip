define(['jquery', 
    'underscore',
    'knockout-mapping', 
    'views/forms/base', 
    'views/forms/sections/branch-list',
    'views/forms/sections/validation',
    'bootstrap-datetimepicker',], 
    function ($, _, koMapping, BaseForm, BranchList, ValidationTools, async) {
        var vt = new ValidationTools();
        return BaseForm.extend({
            initialize: function() {
                BaseForm.prototype.initialize.apply(this);                
                
                var self = this;
                var date_picker = $('.datetimepicker').datetimepicker({pickTime: false});
                date_picker.on('dp.change', function(evt){
                    $(this).find('input').trigger('change'); 
                });

                this.addBranchList(new BranchList({
                    el: this.$el.find('#heritage-type-section')[0],
                    data: this.data,
                    dataKey: 'RESOURCE_TYPE_CLASSIFICATION.E55',
                    validateBranch: function (nodes) {
                        return true;
                    }//,
                    // onSelect2Selecting: function(item, select2Config){
                    //     _.each(this.editedItem(), function(node){
                    //         if (node.entitytypeid() === select2Config.dataKey){
                    //             var labels = node.label().split(',');
                    //             if(node.label() === ''){
                    //                 node.label(item.value);
                    //             }else{
                    //                 if(item.value !== ''){
                    //                     labels.push(item.value);
                    //                 }
                    //                 node.label(labels.join());
                    //             }
                    //             //node.value(item.id);
                    //             node.entitytypeid(item.entitytypeid);
                    //         }
                    //     }, this);
                    //     this.trigger('change', 'changing', item);
                    //}
                }));

                this.addBranchList(new BranchList({
                    el: this.$el.find('#names-section')[0],
                    data: this.data,
                    dataKey: 'NAME.E41',
                    validateBranch: function (nodes) {
                        var valid = true;
                        var primaryname_count = 0;
                        var primaryname_conceptid = this.viewModel.primaryname_conceptid;
                        _.each(nodes, function (node) {
                            if (node.entitytypeid === 'NAME.E41') {
                                if (node.value === ''){
                                    valid = false;
                                }
                            }
                            if (node.entitytypeid === 'NAME_TYPE.E55') {
                                if (node.value === primaryname_conceptid){
                                    _.each(self.viewModel['branch_lists'], function (branch_list) {
                                        _.each(branch_list.nodes, function (node) {
                                            if (node.entitytypeid === 'NAME_TYPE.E55' && node.value === primaryname_conceptid) {
                                                valid = false;
                                            }
                                        }, this);
                                    }, this);
                                }
                            }
                        }, this);
                        return valid;
                    }
                }));

                this.addBranchList(new BranchList({
                    el: this.$el.find('#dates-section')[0],
                    data: this.data,
                    dataKey: 'important_dates',
                    validateBranch: function (nodes) {
                        var ck0 = vt.validateDateEdtfy(nodes,"START_DATE_OF_EXISTENCE.E49,END_DATE_OF_EXISTENCE.E49");
                        var ck1 = this.validateHasValues(nodes);
                        return ck0 && ck1
                    }
                }));

                this.addBranchList(new BranchList({
                    el: this.$el.find('#subjects-section')[0],
                    data: this.data,
                    dataKey: 'KEYWORD.E55',
                    validateBranch: function (nodes) {
                        return this.validateHasValues(nodes);
                    }
                }));
            }
        });
    }
);