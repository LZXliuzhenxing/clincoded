'use strict';
var React = require('react');
var _ = require('underscore');
var globals = require('../globals');
var fetched = require('../fetched');
var RestMixin = require('../rest').RestMixin;
var parseAndLogError = require('../mixins').parseAndLogError;
var form = require('../../libs/bootstrap/form');
var modal = require('../../libs/bootstrap/modal');
var CuratorHistory = require('../curator_history');
var curator = require('../curator');
var modesOfInheritance = require('../mapping/modes_of_inheritance.json');

var Input = form.Input;
var Form = form.Form;
var FormMixin = form.FormMixin;
var Modal = modal.Modal;
var ModalMixin = modal.ModalMixin;
var queryKeyValue = globals.queryKeyValue;

// Display the variant curation action bar above the criteria and tabs
var VariantCurationActions = module.exports.VariantCurationActions = React.createClass({
    mixins: [RestMixin, FormMixin, CuratorHistory],

    propTypes: {
        variantData: React.PropTypes.object, // ClinVar data payload
        session: React.PropTypes.object,
        interpretation: React.PropTypes.object,
        editKey: React.PropTypes.string,
        updateInterpretationObj: React.PropTypes.func
    },

    getInitialState: function() {
        return {
            variantUuid: null,
            interpretation: null,
            hasExistingInterpretation: false,
            isInterpretationActive: false,
            hasAssociatedDisease: false,
            hasAssociatedInheritance: false
        };
    },

    componentWillReceiveProps: function(nextProps) {
        if (this.props.variantData) {
            if (this.props.variantData.associatedInterpretations) {
                if (this.props.variantData.associatedInterpretations.length) {
                    var associatedInterpretations = this.props.variantData.associatedInterpretations;
                    associatedInterpretations.forEach(associatedInterpretation => {
                        if (associatedInterpretation.submitted_by['@id'] === this.props.session.user_properties['@id']) {
                            this.setState({hasExistingInterpretation: true});
                        }
                    });
                }
            }
        }
        if (this.props.editKey === 'true' && this.props.interpretation) {
            this.setState({isInterpretationActive: true});
            if (this.props.interpretation) {
                if (this.props.interpretation.interpretation_disease) {
                    this.setState({hasAssociatedDisease: true});
                }
                if (this.props.interpretation.modeInheritance) {
                    this.setState({hasAssociatedInheritance: true});
                }
            }
        }
    },

    updateParentState: function(mode) {
        if (mode === 'disease') {
            this.setState({hasAssociatedDisease: true});
        } else if (mode === 'inheritance') {
            this.setState({hasAssociatedInheritance: true});
        }
    },

    // handler for 'Start new interpretation' & 'Continue interpretation' button click events
    handleInterpretationEvent: function(e) {
        e.preventDefault(); e.stopPropagation();
        var variantObj = this.props.variantData;
        var selectedTab = queryKeyValue('tab', window.location.href),
            selectedSubtab = queryKeyValue('subtab', window.location.href);
        var newInterpretationObj;
        if (!this.state.hasExistingInterpretation) {
            if (variantObj) {
                this.setState({variantUuid: variantObj.uuid});
                // Put together a new interpretation object
                newInterpretationObj = {variant: variantObj.uuid};
            }
            // Post new interpretation to the DB. Once promise returns, go to /curation-variant page with
            // the new interpretation UUID in the query string.
            this.postRestData('/interpretations/', newInterpretationObj).then(data => {
                var newInterpretationUuid = data['@graph'][0].uuid;
                var meta = {
                    interpretation: {
                        variant: variantObj['@id']
                    }
                };
                this.recordHistory('add-hide', data['@graph'][0], meta).then(result => {
                    window.location.href = '/variant-central/?edit=true&variant=' + this.state.variantUuid + '&interpretation=' + newInterpretationUuid + (selectedTab ? '&tab=' + selectedTab : '') + (selectedSubtab ? '&subtab=' + selectedSubtab : '');
                });
            }).catch(e => {parseAndLogError.bind(undefined, 'postRequest');});
        } else if (this.state.hasExistingInterpretation && !this.state.isInterpretationActive) {
            window.location.href = '/variant-central/?edit=true&variant=' + variantObj.uuid + '&interpretation=' + variantObj.associatedInterpretations[0].uuid + (selectedTab ? '&tab=' + selectedTab : '') + (selectedSubtab ? '&subtab=' + selectedSubtab : '');
        }
    },

    render: function() {
        let interpretationButtonTitle = '';
        if (!this.state.hasExistingInterpretation) {
            interpretationButtonTitle = 'Start New Interpretation';
        } else if (this.state.hasExistingInterpretation && !this.state.isInterpretationActive) {
            interpretationButtonTitle = 'Continue Interpretation';
        }

        return (
            <div className="container curation-actions curation-variant">
                {(this.state.isInterpretationActive) ?
                    <div className="interpretation-record clearfix">
                        <h2><span>Variant Interpretation Record</span></h2>
                        <div className="btn-group">
                            <DiseaseModalButton variantData={this.props.variantData} session={this.props.session} updateParentState={this.updateParentState} hasAssociatedDisease={this.state.hasAssociatedDisease}
                                interpretation={this.props.interpretation} editKey={this.props.editkey} updateInterpretationObj={this.props.updateInterpretationObj} />
                            <InheritanceModalButton variantData={this.props.variantData} session={this.props.session} updateParentState={this.updateParentState} hasAssociatedInheritance={this.state.hasAssociatedInheritance}
                                interpretation={this.props.interpretation} editKey={this.props.editkey} updateInterpretationObj={this.props.updateInterpretationObj} />
                        </div>
                    </div>
                :
                    <div className="interpretation-record clearfix">
                        <h2><span>View Evidence</span></h2>
                        <div className="btn-group">
                            <Input type="button-button" inputClassName="btn btn-primary pull-right" title={interpretationButtonTitle} clickHandler={this.handleInterpretationEvent} />
                        </div>
                    </div>
                }
            </div>
        );
    }
});

var DiseaseModalButton = React.createClass({
    mixins: [ModalMixin],

    propTypes: {
        variantData: React.PropTypes.object,
        hasAssociatedDisease: React.PropTypes.boolean,
        session: React.PropTypes.object,
        updateParentState: React.PropTypes.func,
        interpretation: React.PropTypes.object,
        editKey: React.PropTypes.string,
        updateInterpretationObj: React.PropTypes.func
    },

    render: function() {
        let associateDiseaseButtonTitle = <span>Disease <i className="icon icon-plus-circle"></i></span>,
            associateDiseaseModalTitle = 'Associate this interpretation with a disease';
        if (this.props.hasAssociatedDisease) {
            associateDiseaseButtonTitle = <span>Disease <i className="icon icon-pencil"></i></span>;
            associateDiseaseModalTitle = 'Associate this interpretation with a different disease';
        }

        return (
            <Modal title={associateDiseaseModalTitle} wrapperClassName="modal-associate-disease">
                <button className="btn btn-primary pull-right btn-inline-spacer" modal={<AssociateDisease closeModal={this.closeModal} data={this.props.variantData} session={this.props.session} updateParentState={this.props.updateParentState}
                    interpretation={this.props.interpretation} editKey={this.props.editkey} updateInterpretationObj={this.props.updateInterpretationObj} />}>{associateDiseaseButtonTitle}</button>
            </Modal>
        );
    }
});

var InheritanceModalButton = React.createClass({
    mixins: [ModalMixin],

    propTypes: {
        variantData: React.PropTypes.object,
        hasAssociatedInheritance: React.PropTypes.boolean,
        session: React.PropTypes.object,
        updateParentState: React.PropTypes.func,
        interpretation: React.PropTypes.object,
        editKey: React.PropTypes.string,
        updateInterpretationObj: React.PropTypes.func
    },

    render: function() {
        let associateInheritanceButtonTitle = <span>Inheritance <i className="icon icon-plus-circle"></i></span>,
            associateInheritanceModalTitle = 'Associate this interpretation with a mode of inheritance';
        if (this.props.hasAssociatedInheritance) {
            associateInheritanceButtonTitle = <span>Inheritance <i className="icon icon-pencil"></i></span>;
            associateInheritanceModalTitle = 'Associate this interpretation with a different mode of inheritance';
        }

        return (
            <Modal title={associateInheritanceModalTitle} wrapperClassName="modal-associate-inheritance">
                <button className="btn btn-primary pull-right" modal={<AssociateInheritance closeModal={this.closeModal} data={this.props.variantData} session={this.props.session} updateParentState={this.props.updateParentState}
                    interpretation={this.props.interpretation} editKey={this.props.editkey} updateInterpretationObj={this.props.updateInterpretationObj} />}>{associateInheritanceButtonTitle}</button>
            </Modal>
        );
    }
});

// handle 'Associate with Disease' button click event
var AssociateDisease = React.createClass({
    mixins: [RestMixin, FormMixin, CuratorHistory],

    contextTypes: {
        handleStateChange: React.PropTypes.func
    },

    propTypes: {
        data: React.PropTypes.object,
        session: React.PropTypes.object,
        closeModal: React.PropTypes.func, // Function to call to close the modal
        interpretation: React.PropTypes.object,
        editKey: React.PropTypes.bool,
        updateInterpretationObj: React.PropTypes.func,
        updateParentState: React.PropTypes.func
    },

    getInitialState: function() {
        return {
            submitResourceBusy: false
        };
    },

    // Form content validation
    validateForm: function() {
        // Start with default validation
        var valid = this.validateDefault();

        // Check if orphanetid
        if (valid) {
            valid = this.getFormValue('orphanetid').match(/^ORPHA[0-9]{1,6}$/i);
            if (!valid) {
                this.setFormErrors('orphanetid', 'Use Orphanet IDs (e.g. ORPHA15)');
            }
        }
        return valid;
    },

    // When the form is submitted...
    submitForm: function(e) {
        e.preventDefault(); e.stopPropagation(); // Don't run through HTML submit handler
        // Invoke button progress indicator
        this.setState({submitResourceBusy: true});
        // Get values from form and validate them
        this.saveFormValue('orphanetid', this.refs.orphanetid.getValue());
        if (this.validateForm()) {
            // Get the free-text values for the Orphanet ID to check against the DB
            var orphaId = this.getFormValue('orphanetid').match(/^ORPHA([0-9]{1,6})$/i)[1];
            var interpretationDisease, currInterpretation;
            // Get the disease orresponding to the given Orphanet ID.
            // If either error out, set the form error fields
            this.getRestDatas([
                '/diseases/' + orphaId
            ], [
                function() { this.setFormErrors('orphanetid', 'Orphanet ID not found'); }.bind(this)
            ]).then(data => {
                interpretationDisease = data[0]['@id'];
                this.getRestData('/interpretation/' + this.props.interpretation.uuid).then(interpretation => {
                    currInterpretation = interpretation;
                    // get up-to-date copy of interpretation object and flatten it
                    var flatInterpretation = curator.flatten(currInterpretation);
                    // if the interpretation object does not have a disease object, create it
                    if (!('disease' in flatInterpretation)) {
                        flatInterpretation.disease = '';
                        // Return the newly flattened interpretation object in a Promise
                        return Promise.resolve(flatInterpretation);
                    } else {
                        return Promise.resolve(flatInterpretation);
                    }
                }).then(interpretationObj => {
                    if (interpretationDisease) {
                        // Set the disease '@id' to the newly flattened interpretation object's 'disease' property
                        interpretationObj.disease = interpretationDisease;
                        // Update the intepretation object partially with the new disease property value
                        return this.putRestData('/interpretation/' + this.props.interpretation.uuid, interpretationObj).then(result => {
                            this.props.updateInterpretationObj();
                            this.props.updateParentState('disease');
                            var meta = {
                                interpretation: {
                                    variant: this.props.data['@id'],
                                    disease: interpretationDisease,
                                    mode: 'edit-disease'
                                }
                            };
                            return this.recordHistory('modify', currInterpretation, meta).then(result => {
                                this.setState({submitResourceBusy: false});
                                // Need 'submitResourceBusy' state to proceed closing modal
                                return Promise.resolve(this.state.submitResourceBusy);
                            });
                        }).then(submitState => {
                            // Close modal after 'submitResourceBusy' is completed
                            if (submitState !== true) {
                                this.props.closeModal();
                            }
                        });
                    }
                });
            }).catch(e => {
                // Some unexpected error happened
                this.setState({submitResourceBusy: false});
                parseAndLogError.bind(undefined, 'fetchedRequest');
            });
        }
    },

    // Called when the modal 'Cancel' button is clicked
    cancelAction: function(e) {
        this.setState({submitResourceBusy: false});
        this.props.closeModal();
    },

    render: function() {
        var disease_id = '';
        if (this.props.interpretation) {
            if (this.props.interpretation.interpretation_disease) {
                disease_id = this.props.interpretation.interpretation_disease;
            }
        }

        return (
            <Form submitHandler={this.submitForm} formClassName="form-std">
                <div className="modal-box">
                    <div className="modal-body clearfix">
                        <Input type="text" ref="orphanetid" label={<LabelOrphanetId />} placeholder="e.g. ORPHA15" value={(disease_id) ? disease_id : null}
                            error={this.getFormError('orphanetid')} clearError={this.clrFormErrors.bind(null, 'orphanetid')}
                            labelClassName="col-sm-4 control-label" wrapperClassName="col-sm-7" groupClassName="form-group" inputClassName="uppercase-input" required />
                    </div>
                    <div className='modal-footer'>
                        <Input type="button" inputClassName="btn-default btn-inline-spacer" clickHandler={this.cancelAction} title="Cancel" />
                        <Input type="submit" inputClassName="btn-primary btn-inline-spacer" title="OK" submitBusy={this.state.submitResourceBusy} />
                    </div>
                </div>
            </Form>
        );
    }
});

var LabelOrphanetId = React.createClass({
    render: function() {
        return <span>Enter <a href="http://www.orpha.net/" target="_blank" title="Orphanet home page in a new tab">Orphanet</a> ID</span>;
    }
});

// handle 'Associate with Disease' button click event
var AssociateInheritance = React.createClass({
    mixins: [RestMixin, FormMixin, CuratorHistory],

    contextTypes: {
        handleStateChange: React.PropTypes.func
    },

    propTypes: {
        data: React.PropTypes.object,
        session: React.PropTypes.object,
        closeModal: React.PropTypes.func, // Function to call to close the modal
        interpretation: React.PropTypes.object,
        editKey: React.PropTypes.bool,
        updateInterpretationObj: React.PropTypes.func,
        updateParentState: React.PropTypes.func
    },

    getInitialState: function() {
        return {
            submitResourceBusy: false
        };
    },

    // When the form is submitted...
    submitForm: function(e) {
        e.preventDefault(); e.stopPropagation(); // Don't run through HTML submit handler
        // Invoke button progress indicator
        this.setState({submitResourceBusy: true});
        // Get values from form and validate them
        this.saveFormValue('inheritance', this.refs.inheritance.getValue());

        let inheritance = this.getFormValue('inheritance');
        let interpretationDisease, currInterpretation;

        this.getRestData('/interpretation/' + this.props.interpretation.uuid).then(interpretation => {
            currInterpretation = interpretation;
            // get up-to-date copy of interpretation object and flatten it
            var flatInterpretation = curator.flatten(currInterpretation);

            flatInterpretation.modeInheritance = inheritance;

            return this.putRestData('/interpretation/' + this.props.interpretation.uuid, flatInterpretation).then(result => {
                this.props.updateInterpretationObj();
                this.props.updateParentState('inheritance');
                var meta = {
                    interpretation: {
                        variant: this.props.data['@id'],
                        mode: 'edit-inheritance'
                    }
                };
                return this.recordHistory('modify', currInterpretation, meta).then(result => {
                    this.setState({submitResourceBusy: false});
                    // Need 'submitResourceBusy' state to proceed closing modal
                    return Promise.resolve(this.state.submitResourceBusy);
                });
            });
        }).then(result => {
            this.setState({submitResourceBusy: false});
            this.props.closeModal();
        }).catch(e => {
            // Some unexpected error happened
            this.setState({submitResourceBusy: false});
            parseAndLogError.bind(undefined, 'fetchedRequest');
        });
    },

    // Called when the modal 'Cancel' button is clicked
    cancelAction: function(e) {
        this.setState({submitResourceBusy: false});
        this.props.closeModal();
    },

    render: function() {
        var defaultModeInheritance = 'select';
        if (this.props.interpretation) {
            if (this.props.interpretation.modeInheritance) {
                defaultModeInheritance = this.props.interpretation.modeInheritance;
            }
        }

        return (
            <Form submitHandler={this.submitForm} formClassName="form-std">
                <div className="modal-box">
                    <div className="modal-body clearfix">
                        <Input type="select" ref="inheritance" label="Mode of Inheritance" defaultValue={defaultModeInheritance}
                            labelClassName="col-sm-4 control-label" wrapperClassName="col-sm-7" groupClassName="form-group" inputClassName="inheritance" required>
                            <option value="select" disabled="disabled">Select</option>
                            <option value="" disabled="disabled"></option>
                            {modesOfInheritance.map(function(modeOfInheritance, i) {
                                return <option key={i} value={modeOfInheritance}>{modeOfInheritance}</option>;
                            })}
                        </Input>
                    </div>
                    <div className='modal-footer'>
                        <Input type="button" inputClassName="btn-default btn-inline-spacer" clickHandler={this.cancelAction} title="Cancel" />
                        <Input type="submit" inputClassName="btn-primary btn-inline-spacer" title="OK" submitBusy={this.state.submitResourceBusy} />
                    </div>
                </div>
            </Form>
        );
    }
});
