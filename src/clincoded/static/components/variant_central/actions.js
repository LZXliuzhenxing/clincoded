'use strict';
var React = require('react');
var globals = require('../globals');
var RestMixin = require('../rest').RestMixin;
var parseAndLogError = require('../mixins').parseAndLogError;
var form = require('../../libs/bootstrap/form');
var modal = require('../../libs/bootstrap/modal');

var Input = form.Input;
var Form = form.Form;
var FormMixin = form.FormMixin;
var Modal = modal.Modal;
var ModalMixin = modal.ModalMixin;
var queryKeyValue = globals.queryKeyValue;

// Display the variant curation action bar above the criteria and tabs
var VariantCurationActions = module.exports.VariantCurationActions = React.createClass({
    mixins: [RestMixin, ModalMixin],

    propTypes: {
        variantData: React.PropTypes.object, // ClinVar data payload
        session: React.PropTypes.object,
        interpretation: React.PropTypes.object,
        editKey: React.PropTypes.string
    },

    getInitialState: function() {
        return {
            variantUuid: null,
            hasExistingInterpretation: false,
            isEditMode: false,
            hasAssociatedDisease: false
        };
    },

    componentWillReceiveProps: function(nextProps) {
        if (nextProps.variantData && this.props.variantData) {
            if (this.props.variantData.associatedInterpretations) {
                if (this.props.variantData.associatedInterpretations.length && this.props.variantData.submitted_by['@id'] === this.props.session.user_properties['@id']) {
                    this.setState({hasExistingInterpretation: true});
                }
            }
        }
        if (this.props.editKey === 'true' && this.props.interpretation) {
            this.setState({isEditMode: true});
        }
    },

    // handler for 'Start new interpretation' & 'Continue interpretation' button click events
    handleInterpretationEvent: function(e) {
        e.preventDefault(); e.stopPropagation();
        var variantObj = this.props.variantData;
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
                window.location.href = '/variant-central/?edit=true&variant=' + this.state.variantUuid + '&interpretation=' + newInterpretationUuid;
            }).catch(e => {parseAndLogError.bind(undefined, 'postRequest')});
        } else if (this.state.hasExistingInterpretation && !this.isEditMode) {
            window.location.href = '/variant-central/?edit=true&variant=' + variantObj.uuid + '&interpretation=' + variantObj.associatedInterpretations[0].uuid;
        }
    },

    render: function() {
        var interpretationButtonTitle = '';
        if (!this.state.hasExistingInterpretation) {
            interpretationButtonTitle = 'Start New Interpretation';
        } else if (this.state.hasExistingInterpretation && !this.isEditMode) {
            interpretationButtonTitle = 'Continue Interpretation';
        }

        return (
            <Form formClassName="form-horizontal form-std">
                <div className="container curation-actions curation-variant">
                    {(this.state.isEditMode) ?
                        <div className="interpretation-record clearfix">
                            <h2><span>Variant Interpretation Record</span></h2>
                            <div className="btn-group">
                                <Modal title="Associate with Disease" wrapperClassName="modal-associate-disease">
                                    <button className="btn btn-primary pull-right"
                                        modal={<AssociateDisease closeModal={this.closeModal} data={this.props.variantData} interpretation={this.props.interpretation} editKey={this.props.editkey} />}>Associate with Disease</button>
                                </Modal>
                            </div>
                        </div>
                        :
                        <div className="evidence-only clearfix">
                            <Input type="button-button" inputClassName="btn btn-primary pull-right" title={interpretationButtonTitle} clickHandler={this.handleInterpretationEvent} />
                        </div>
                    }
                </div>
            </Form>
        );
    }
});

// handle 'Associate with Disease' button click event
var AssociateDisease = React.createClass({
    mixins: [RestMixin, FormMixin],

    propTypes: {
        data: React.PropTypes.object,
        closeModal: React.PropTypes.func, // Function to call to close the modal
        interpretation: React.PropTypes.object,
        editKey: React.PropTypes.bool
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

        // Get values from form and validate them
        this.saveFormValue('orphanetid', this.refs.orphanetid.getValue());
        if (this.validateForm()) {
            // Get the free-text values for the Orphanet ID to check against the DB
            var orphaId = this.getFormValue('orphanetid').match(/^ORPHA([0-9]{1,6})$/i)[1];

            // Get the disease orresponding to the given Orphanet ID.
            // If either error out, set the form error fields
            this.getRestDatas([
                '/diseases/' + orphaId
            ], [
                function() { this.setFormErrors('orphanetid', 'Orphanet ID not found'); }.bind(this)
            ]).then(data => {
                this.props.closeModal();
            }).catch(e => {
                // Some unexpected error happened
                parseAndLogError.bind(undefined, 'fetchedRequest');
            });
        }
    },

    // Called when the modal 'Cancel' button is clicked
    cancelAction: function(e) {
        this.props.closeModal();
    },

    render: function() {
        return (
            <div className="modal-box">
                <div className="modal-body">
                    <Input type="text" ref="orphanetid" label={<LabelOrphanetId />} placeholder="e.g. ORPHA15"
                        error={this.getFormError('orphanetid')} clearError={this.clrFormErrors.bind(null, 'orphanetid')}
                        labelClassName="col-sm-4 control-label" wrapperClassName="col-sm-7" groupClassName="form-group" inputClassName="uppercase-input" required />
                </div>
                <div className='modal-footer'>
                    <Input type="button" inputClassName="btn-default btn-inline-spacer" clickHandler={this.cancelAction} title="Cancel" />
                    <Input type="button" inputClassName="btn-primary btn-inline-spacer" clickHandler={this.submitForm} title="OK" submitBusy={this.state.submitResourceBusy} />
                </div>
            </div>
        );
    }
});

var LabelOrphanetId = React.createClass({
    render: function() {
        return <span>Enter <a href="http://www.orpha.net/" target="_blank" title="Orphanet home page in a new tab">Orphanet</a> ID</span>;
    }
});
