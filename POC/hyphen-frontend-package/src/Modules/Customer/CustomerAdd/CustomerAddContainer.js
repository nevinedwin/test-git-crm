import { connect } from "react-redux";
import React, { Component } from "react";

import { history } from "../../../Core/Store";
import { newCustomer } from '../../../Services/CustomerService';
import {
    CUSTOMER_ADD_REQUEST,
    CUSTOMER_ADD_SUCCESS,
    CUSTOMER_ADD_FAILED
} from '../../../Utilities/Constants';
import CustomerAdd from './CustomerAdd';
import { ManageLocalStorage } from "../../../Services/LocalStorage";
import { openSnackbar } from '../../../Shared/Components/Notifier';
import ConfirmationDialog from '../../../Shared/Components/Confirmation';
import CustomerModel from './CustomerModel';
import { setFloatBtnData } from '../../../Actions/FloatBtn';

class CustomerAddContainer extends Component {
    _isMounted = false;
    constructor(props) {
        super(props);
        this.events = this.bindEvents();
        this.state = {
            formKey: 1,
            customerNew: new CustomerModel(),
            openAddCustomerConfirmationDialog: false,
            openCancelCustomerConfirmationDialog: false,
            openResetCustomerConfirmationDialog: false,
            addNewOnSubmit: false
        }
    }

    bindEvents() {
        return {
            customerAction: this.customerAction.bind(this),
            confirmationOk: this.confirmationOk.bind(this),
            confirmationCancel: this.confirmationCancel.bind(this)
        };
    }

    confirmationCancel(action) {
        switch (action) {
            case 'customer_add':
                this.setState({ openAddCustomerConfirmationDialog: false });
                break;
            case 'customer_cancel':
                this.setState({ openCancelCustomerConfirmationDialog: false });
                break;
            case 'customer_reset':
                this.setState({ openResetCustomerConfirmationDialog: false });
                break;
            default:
                break;
        }
    }

    confirmationOk(action) {
        switch (action) {
            case 'customer_add':
                this.setState({ openAddCustomerConfirmationDialog: false });
                this.props.dispatch({ type: CUSTOMER_ADD_REQUEST });
                let payload = this.state.customerNew;
                payload.type = "customer";
                payload.org_id = this.userAWSAttributes['custom:org_id'];
                newCustomer(payload).then(res => {
                    if (res.status) {
                        this.props.dispatch({ type: CUSTOMER_ADD_SUCCESS });
                        let obj = {
                            message: "Customer Added Successfully !!",
                            variant: "success"
                        };
                        openSnackbar(obj);
                        if (this.state.addNewOnSubmit) {
                            this.setState({ formKey: (this.state.formKey + 1) });
                        } else {
                            history.push("/customer/" + res.item.id);
                        }
                    } else {
                        this.props.dispatch({ type: CUSTOMER_ADD_FAILED });
                        let obj = {
                            message: "Something Went Wrong !!",
                            variant: "error"
                        };
                        openSnackbar(obj);
                    }
                },
                    error => {
                        this.props.dispatch({ type: CUSTOMER_ADD_FAILED });
                        let obj = {
                            message: "Something Went Wrong !!",
                            variant: "error"
                        };
                        openSnackbar(obj);
                    });
                break;
            case 'customer_cancel':
                this.setState({ openCancelCustomerConfirmationDialog: false });
                history.goBack();
                break;
            case 'customer_reset':
                this.setState({ formKey: (this.state.formKey + 1) });
                this.setState({ openResetCustomerConfirmationDialog: false });
                break;
            default:
                break;
        }
    }

    customerAction(action, customerNew, addNewOnSubmit) {
        switch (action) {
            case 'customer_add':
                this.setState({ customerNew }, () => {
                    this.setState({ addNewOnSubmit });
                    // this.setState({ openAddCustomerConfirmationDialog: true });
                    this.events.confirmationOk('customer_add');
                });
                break;
            case 'customer_reset':
                this.setState({ openResetCustomerConfirmationDialog: true });
                break;
            case 'customer_cancel':
                this.setState({ openCancelCustomerConfirmationDialog: true });
                break;
            default:
                break;
        }
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    componentDidMount() {
        this._isMounted = true;
        this.props.dispatch(
            setFloatBtnData({
                floatBtnData: {
                    currentComponent: 'customer_add'
                }
            })
        );
        this.userAWSAttributes = JSON.parse(ManageLocalStorage.get("userAWSAttributes"));
    }

    render() {
        return (
            <>
                {
                    this.props.state.listReducer.listData &&
                    <CustomerAdd key={this.state.formKey}
                        customerAction={this.events.customerAction}
                        propertyLists={this.props.state.listReducer.listData.propertyLists}
                        influenceList={this.props.state.listReducer.listData.influenceList}
                        desiredFeaturesList={this.props.state.listReducer.listData.desiredFeaturesList}
                        stageList={this.props.state.listReducer.listData.stageList}
                        desiredMoveList={this.props.state.listReducer.listData.desiredMoveList}
                        contactMethodList={this.props.state.listReducer.listData.contactMethodList}
                        realtorList={this.props.state.listReducer.listData.realtorList}
                        sourceList={this.props.state.listReducer.listData.sourceList}
                        gradeList={this.props.state.listReducer.listData.gradeList} />
                }
                {this.state.openAddCustomerConfirmationDialog && <ConfirmationDialog id="add-customer-confirm-id"
                    title="Add New Customer" message="New customer will be added under home builder. Do you want to continue?" action="customer_add"
                    onOk={this.events.confirmationOk}
                    onCancel={this.events.confirmationCancel} />}
                {this.state.openCancelCustomerConfirmationDialog && <ConfirmationDialog id="cancel-customer-confirm-id"
                    title="Confirm Cancellation" message="Changes made will be discarded and will go back to previous page. Do you want to continue?" action="customer_cancel"
                    onOk={this.events.confirmationOk}
                    onCancel={this.events.confirmationCancel} />}
                {this.state.openResetCustomerConfirmationDialog && <ConfirmationDialog id="reset-customer-confirm-id"
                    title="Confirm Form Reset" message="All form data will be discarded. Do you want to continue?" action="customer_reset"
                    onOk={this.events.confirmationOk}
                    onCancel={this.events.confirmationCancel} />}
            </>
        );
    }
}

const mapStateToProps = state => {
    return { state };
};

export default connect(mapStateToProps)(CustomerAddContainer);