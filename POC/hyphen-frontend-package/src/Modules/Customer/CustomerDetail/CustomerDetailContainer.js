import { connect } from "react-redux";
import React, { Component } from "react";

import CustomerDetail from './CustomerDetail';
import {

} from '../../../Utilities/Constants';
import {
    loadCustomerDetails,
    updateCustomer,
    deleteCustomer
} from '../../../Services/CustomerService';
import {
    GET_CUSTOMER_DETAIL_REQUEST,
    GET_CUSTOMER_DETAIL_SUCCESS,
    GET_CUSTOMER_DETAIL_FAILED
} from '../../../Utilities/Constants';
import { ManageLocalStorage } from "../../../Services/LocalStorage";
import { setFloatBtnData } from '../../../Actions/FloatBtn';
import { history } from "../../../Core/Store";
import { openSnackbar } from '../../../Shared/Components/Notifier';
import { randomNumberBtwn, diffYMDHMS } from '../../../Utilities/Utils';

import _ from "lodash";

let moment = require('moment');

class CustomerDetailContainer extends Component {
    _isMounted = false;
    userAWSAttributes = {};
    constructor(props) {
        super(props);
        this.events = this.bindEvents();
        this.state = {
            desiredFeaturesList: _.cloneDeep(this.props.state.listReducer.listData.desiredFeaturesList),
            influenceList: _.cloneDeep(this.props.state.listReducer.listData.influenceList),
            resetDetail: 1
        };

    }
    bindEvents() {
        return {
            getCustomerDetails: this.getCustomerDetails.bind(this),
            getPropertyLists: this.getPropertyLists.bind(this),
            updatePropertiesAction: this.updatePropertiesAction.bind(this),
            deleteCustomerAction: this.deleteCustomerAction.bind(this),
            reloadDetailComponent: this.reloadDetailComponent.bind(this)
        };
    }

    getCustomerDetails(callback) {
        this.props.dispatch({ type: GET_CUSTOMER_DETAIL_REQUEST });
        loadCustomerDetails(this.props.match.params.id, this.userAWSAttributes['custom:org_id']).then(res => {
            this.props.dispatch({ type: GET_CUSTOMER_DETAIL_SUCCESS });
            if (this._isMounted) {
                if (res.length && res[0].id) {
                    res[0].name = res[0]['fname'] + ' ' + res[0]['lname'];
                    let last_modifiedTempDate = moment(res[0].mdt);
                    let date_addedTempDate = moment(res[0].jdt);
                    res[0].last_modified = last_modifiedTempDate.format('MMMM Do YYYY, h:mm a');
                    res[0].date_added = date_addedTempDate.format('MMMM Do YYYY, h:mm a');
                    res[0].acti = _.sortBy(res[0].acti, function (obj) {
                        return obj.date;
                    });
                    let activityTemp = _.cloneDeep(res[0].acti.reverse());

                    res[0].acti = [];

                    let previousDate = moment();

                    activityTemp.forEach((item, i) => {
                        let tempDate = moment(item.date);
                        item.dateText = tempDate.format('MMMM Do YYYY, h:mm a');
                        let DateDiff = diffYMDHMS(moment(previousDate), moment(item.date));
                        if (res[0].acti.length && DateDiff !== '') {
                            res[0].acti.push({
                                dateText: DateDiff
                            });
                        }
                        res[0].acti.push(item);
                        previousDate = item.date;
                    });
                    let propertyListTemp = _.cloneDeep(this.state.propertyLists);
                    propertyListTemp.forEach((item, index) => {
                        propertyListTemp[index].checked = false;
                    });
                    if (res[0].inte && res[0].inte.length > 0) {
                        res[0].inte.forEach((item, i) => {
                            propertyListTemp.forEach((element, index) => {
                                if (item.id === element.id) {
                                    propertyListTemp[index].checked = false;
                                    propertyListTemp[index].checked = item.checked;
                                }
                            });
                        });
                    }

                    let desiredFeaturesListTemp = _.cloneDeep(this.state.desiredFeaturesList);
                    desiredFeaturesListTemp.forEach((item, index) => {
                        desiredFeaturesListTemp[index].checked = false;
                    });
                    if (res[0].desf && res[0].desf.length > 0) {
                        res[0].desf.forEach((item, i) => {
                            desiredFeaturesListTemp.forEach((element, index) => {
                                if (item.id === element.id) {
                                    desiredFeaturesListTemp[index].checked = item.checked;
                                }
                            });
                        });
                    }

                    let influenceListTemp = _.cloneDeep(this.state.influenceList);
                    influenceListTemp.forEach((item, index) => {
                        influenceListTemp[index].checked = false;
                    });
                    if (res[0].infl && res[0].infl.length > 0) {
                        res[0].infl.forEach((item, i) => {
                            influenceListTemp.forEach((element, index) => {
                                if (item.id === element.id) {
                                    influenceListTemp[index].checked = item.checked;
                                }
                            });
                        });
                    }

                    this.setState({ propertyLists: propertyListTemp });
                    this.setState({ desiredFeaturesList: desiredFeaturesListTemp });
                    this.setState({ influenceList: influenceListTemp });
                    this.setState({ customerDetail: res[0] });

                    // this.events.reloadDetailComponent();

                    if (callback) {
                        callback();
                    }
                } else {
                    this.props.dispatch({ type: GET_CUSTOMER_DETAIL_FAILED });
                }
            }
        });
    }

    getPropertyLists(callback) {
        let res = this.props.state.listReducer.listData.propertyLists;
        if (res && res.length >= 0) {
            res.forEach((element, index) => {
                res[index].checked = false;
            });
            if (this._isMounted) {
                this.setState({ propertyLists: res });
                this.events.getCustomerDetails();
            }
            if (callback) {
                callback();
            }
        }
    }

    updatePropertiesAction(key, value) {
        this.props.dispatch({ type: GET_CUSTOMER_DETAIL_REQUEST });
        let payload = {
            org_id: this.userAWSAttributes['custom:org_id'],
            attrn: key,
            attrv: value,
            user_id: this.state.customerDetail.id
        };
        updateCustomer(payload).then(res => {
            if (this._isMounted) {
                if (res.status) {
                    this.props.dispatch({ type: GET_CUSTOMER_DETAIL_SUCCESS });
                    // this.events.getPropertyLists();
                    // openSnackbar({
                    //     message: "Updated Successfully !!",
                    //     variant: "success"
                    // });
                } else {
                    this.props.dispatch({ type: GET_CUSTOMER_DETAIL_FAILED });
                }
            }
        });
    }

    deleteCustomerAction() {
        this.props.dispatch({ type: GET_CUSTOMER_DETAIL_REQUEST });
        let payload = {
            user_id: this.state.customerDetail.id
        };
        deleteCustomer(payload).then(res => {
            if (this._isMounted) {
                if (res.status) {
                    this.props.dispatch({ type: GET_CUSTOMER_DETAIL_SUCCESS });
                    openSnackbar({
                        message: "Deleted Successfully !!",
                        variant: "success"
                    });
                    history.goBack();
                } else {
                    this.props.dispatch({ type: GET_CUSTOMER_DETAIL_FAILED });
                }
            }
        });
    }

    reloadDetailComponent() {
        this.setState({ resetDetail: randomNumberBtwn() });
    }

    componentDidMount() {
        this._isMounted = true;
        this.props.dispatch(
            setFloatBtnData({
                floatBtnData: {
                    currentComponent: 'customer_detail'
                }
            })
        );
        this.userAWSAttributes = JSON.parse(ManageLocalStorage.get("userAWSAttributes"));
        this.events.getPropertyLists();
    }

    componentWillUnmount() {
        this._isMounted = false;
    }
    render() {
        return (
            <>
                {
                    this.state &&
                    this.state.customerDetail &&
                    <CustomerDetail key={this.state.resetDetail}
                        updateProperties={this.events.updatePropertiesAction}
                        deleteCustomer={this.events.deleteCustomerAction}
                        reloadDetailComponent={this.events.reloadDetailComponent}
                        customerDetail={this.state.customerDetail}
                        propertyLists={this.state.propertyLists}
                        desiredFeaturesLists={this.state.desiredFeaturesList}
                        influenceList={this.state.influenceList}
                        gradeList={this.props.state.listReducer.listData.gradeList}
                        stageList={this.props.state.listReducer.listData.stageList}
                        desiredMoveList={this.props.state.listReducer.listData.desiredMoveList}
                        contactMethodList={this.props.state.listReducer.listData.contactMethodList}
                        realtorList={this.props.state.listReducer.listData.realtorList} />
                }
            </>
        );
    }
}

const mapStateToProps = state => {
    return { state };
};

export default connect(mapStateToProps)(CustomerDetailContainer);