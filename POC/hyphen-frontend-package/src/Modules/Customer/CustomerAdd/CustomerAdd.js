import React, { Component } from "react";
import _ from "lodash";

import CheckboxList from '../../../Shared/Components/CheckBoxList';
import SelectBox from '../../../Shared/Components/SelectBox';
import RadioBox from '../../../Shared/Components/RadioBox';
import CustomerModel from './CustomerModel';
import PopOverMUI from '../../../Shared/Components/PopOver';
import { openSnackbar } from '../../../Shared/Components/Notifier';
import { ManageLocalStorage } from "../../../Services/LocalStorage";

class CustomerAdd extends Component {
    userAWSAttributes = {};
    customerList = [];
    initialState = {
        influenceList: _.cloneDeep(this.props.influenceList),
        customerNew: new CustomerModel(),
        sourceList: _.cloneDeep(this.props.sourceList),
        gradeList: _.cloneDeep(this.props.gradeList),
        stageList: _.cloneDeep(this.props.stageList),
        desiredMoveList: _.cloneDeep(this.props.desiredMoveList),
        contactMethodList: _.cloneDeep(this.props.contactMethodList),
        realtorList: _.cloneDeep(this.props.realtorList),
        desiredFeaturesList: _.cloneDeep(this.props.desiredFeaturesList),
        propertyLists: _.cloneDeep(this.props.propertyLists),
        addNewOnSubmit: false
    };
    constructor(props, context) {
        super(props, context);
        this.events = this.bindEvents();
        this.state = this.initialState;
    }

    bindEvents() {
        return {
            updateFormAction: this.updateFormAction.bind(this),
            saveAndAdd: this.saveAndAdd.bind(this),
        };
    }

    updateFormAction(value, name) {
        let customerNew = { ...this.state.customerNew, [name]: value }
        this.setState({ customerNew });
    }

    handleNewCustomerFormChange = event => {
        this.events.updateFormAction(event.target.value, event.target.id);
    }

    handleCustomerAddSubmit = event => {
        event.preventDefault();
        if (this.customerList.length) {
            if (_.find(this.customerList, { email: this.state.customerNew.email })) {
                openSnackbar({
                    message: "Email ID Already In Use !",
                    variant: "info"
                });
                return;
            }
        }
        if (this.state.customerNew.stage.length === 0) {
            openSnackbar({
                message: "Please Select Stage !",
                variant: "info"
            });
            return;
        }
        if (this.state.customerNew.psrc.length === 0) {
            openSnackbar({
                message: "Please Select Source !",
                variant: "info"
            });
            return;
        }
        if (this.state.customerNew.grade.length === 0) {
            openSnackbar({
                message: "Please Select Grade !",
                variant: "info"
            });
            return;
        }
        if (this.state.customerNew.cntm.length === 0) {
            openSnackbar({
                message: "Please Select Contact !",
                variant: "info"
            });
            return;
        }
        this.props.customerAction('customer_add', this.state.customerNew, this.state.addNewOnSubmit);
    }

    resetForm = event => {
        this.props.customerAction('customer_reset');
    }

    goBack = () => {
        this.props.customerAction('customer_cancel');
    }

    saveAndAdd = event => {
        this.setState({ addNewOnSubmit: true }, () => {
            this.submitBtn.click();
        });
    }

    componentDidMount() {
        this.customerList = JSON.parse(ManageLocalStorage.get("customerList"));
    }

    render() {
        // let checkedInfluences = [];
        // if (this.state.customerNew.infl) {
        //     checkedInfluences = (this.state.customerNew.infl.filter(function (obj) {
        //         return obj.checked === true;
        //     }));
        // }
        return (<>
            {
                <div className="container-fluid">
                    <div className="row">
                        <div className="col-xl-5 col-lg-7 col-md-10 col-12 mx-auto">
                            <h4 className="font-weight-bold mt-4">New Customer</h4>
                            <div className="bg-white box-shadow px-4 py-4 rounded-corner mt-4 mb-4">
                                <form onSubmit={this.handleCustomerAddSubmit}>
                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="fname">First Name <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    id="fname"
                                                    name="fname"
                                                    placeholder="First Name"
                                                    autoFocus
                                                    required
                                                    value={this.state.customerNew.fname}
                                                    onChange={this.handleNewCustomerFormChange}
                                                />
                                            </div>
                                        </div>

                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="lname">Last Name <span className="text-danger">*</span></label>
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    id="lname"
                                                    name="lname"
                                                    required
                                                    placeholder="Last Name"
                                                    value={this.state.customerNew.lname}
                                                    onChange={this.handleNewCustomerFormChange}
                                                />
                                            </div>
                                        </div>

                                    </div>

                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="email">Email <span className="text-danger">*</span></label>
                                                <input
                                                    type="email"
                                                    className="form-control"
                                                    id="email"
                                                    name="email"
                                                    required
                                                    placeholder="Email"
                                                    value={this.state.customerNew.email}
                                                    onChange={this.handleNewCustomerFormChange}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="phone">Phone <span className="text-danger">*</span></label>
                                                <input
                                                    type="tel"
                                                    className="form-control"
                                                    id="phone"
                                                    name="phone"
                                                    pattern="^\d{3}-\d{3}-\d{4}$"
                                                    required
                                                    placeholder="e.g. 123-123-1234"
                                                    value={this.state.customerNew.phone}
                                                    onChange={this.handleNewCustomerFormChange}
                                                />
                                                {/* <small id="emailHelp" class="form-text text-muted">format xxx-xxx-xxxx</small> */}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="stage">Stage <span className="text-danger">*</span></label>
                                                <SelectBox
                                                    id="stage"
                                                    currentValue={''}
                                                    required
                                                    updateAction={this.events.updateFormAction}
                                                    list={this.state.stageList} />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="psrc">Source <span className="text-danger">*</span></label>
                                                <SelectBox
                                                    id="psrc"
                                                    currentValue={''}
                                                    updateAction={this.events.updateFormAction}
                                                    list={this.state.sourceList} />
                                            </div>
                                        </div>
                                    </div>


                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="grade">Grade <span className="text-danger">*</span></label>
                                                <SelectBox
                                                    id="grade"
                                                    currentValue={''}
                                                    updateAction={this.events.updateFormAction}
                                                    list={this.state.gradeList} />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="cntm">Contact Method <span className="text-danger">*</span></label>
                                                <SelectBox
                                                    id="cntm"
                                                    currentValue={''}
                                                    updateAction={this.events.updateFormAction}
                                                    list={this.state.contactMethodList} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="rltr">Realtor</label>
                                                <PopOverMUI
                                                    id="realtorPopOverId"
                                                    checkedItems={this.state.customerNew.rltr}
                                                    htmlTag="select"
                                                    emptyText="Add Realtor"
                                                    joinProperty="name"
                                                    childrenWrapClass="px-3 py-3"
                                                >
                                                    <RadioBox
                                                        id="rltr"
                                                        currentValue={this.state.customerNew.rltr}
                                                        updateAction={this.events.updateFormAction}
                                                        list={this.state.realtorList}
                                                        enableNative={false}
                                                        row={false}
                                                    />
                                                </PopOverMUI>
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="block-divider" />

                                    <div className="row mt-3">
                                        <div className="col-md-12">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="infl">Influence</label>
                                                <CheckboxList id="infl" keyValue="infl"
                                                    updateAction={this.events.updateFormAction}
                                                    list={this.state.influenceList}
                                                    enableNative={true} row={false}
                                                />
                                                {/* <PopOverMUI
                                                    id="influencePopOverId"
                                                    htmlTag="checkbox"
                                                    checkedItems={checkedInfluences}
                                                    emptyText="Add Influence"
                                                    joinProperty="name"
                                                    childrenWrapClass="px-3 py-3"
                                                >
                                                </PopOverMUI> */}
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="block-divider" />

                                    <div className="row mt-3">
                                        <div className="col-md-12">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="contact_method">Interests</label>
                                                <CheckboxList
                                                    id="interest"
                                                    keyValue="inte"
                                                    updateAction={this.events.updateFormAction}
                                                    list={this.state.propertyLists}
                                                    enableNative={true} />
                                            </div>
                                        </div>

                                    </div>

                                    <hr className="block-divider" />

                                    <div className="row">
                                        <div className="col-md-12">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="desf">Desired Features</label>
                                                <CheckboxList
                                                    id="desf"
                                                    keyValue="desf"
                                                    updateAction={this.events.updateFormAction}
                                                    list={this.state.desiredFeaturesList}
                                                    enableNative={true} />
                                            </div>
                                        </div>
                                    </div>

                                    <hr className="block-divider" />

                                    <div className="row">
                                        <div className="col-md-12">
                                            <div className="form-group">
                                                <label className="form-label" htmlFor="desm">How soon do you want to move?</label>
                                                <RadioBox
                                                    id="desm"
                                                    currentValue={this.state.customerNew.desm}
                                                    updateAction={this.events.updateFormAction}
                                                    list={this.state.desiredMoveList}
                                                    enableNative={true} />
                                            </div>
                                        </div>

                                    </div>

                                    <hr className="block-divider" />

                                    <button type="submit" className="btn btn-primary mr-2" ref={e => (this.submitBtn = e)}>Save</button>
                                    <button type="button" className="btn btn-secondary mr-2" onClick={this.resetForm}>Reset</button>
                                    <button type="button" className="btn btn-secondary mr-2" onClick={this.events.saveAndAdd}>Save and Add Another</button>
                                    <button type="button" className="btn btn-clear " onClick={this.goBack}>Cancel</button>



                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            }
        </>);
    }
}

export default CustomerAdd;
