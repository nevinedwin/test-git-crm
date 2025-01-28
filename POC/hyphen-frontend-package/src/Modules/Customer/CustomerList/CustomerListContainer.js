import { connect } from "react-redux";
import React, { Component } from "react";

import CustomerList from './CustomerList';
import { loadCustomers, searchCustomers, createListDataCustomer } from '../../../Services/CustomerService';
import { ManageLocalStorage } from "../../../Services/LocalStorage";
import {
    GET_CUSTOMER_LIST_REQUEST,
    GET_CUSTOMER_LIST_SUCCESS,
    GET_CUSTOMER_LIST_FAILED
} from '../../../Utilities/Constants';
import { history } from '../../../Core/Store';
import { setFloatBtnData } from '../../../Actions/FloatBtn';
import { openSnackbar } from '../../../Shared/Components/Notifier';
import { getUniqueFromArrayByKey } from '../../../Utilities/Utils';

import './CustomerList.scss';

class CustomerListContainer extends Component {
    userAWSAttributes = {};
    _isMounted = false;
    constructor(props, context) {
        super(props, context);
        this.events = this.bindEvents();
        this.state = {
            customers: [],
            searchResult: [],
            showNewCustomerModal: false
        };
    }

    bindEvents() {
        return {
            getCustomer: this.getCustomer.bind(this),
            getCustomerDetailAction: this.getCustomerDetailAction.bind(this),
            searchCustomer: this.searchCustomer.bind(this)
        };
    }

    getCustomerDetailAction(customerItem) {
        history.push("/customer/" + customerItem);
    }

    formatCustomerList(res) {
        let rows = [];
        res.forEach((item, i) => {
            rows.push(createListDataCustomer(item));
        });
        return rows;
    }

    formatCustomerListES(res) {
        let rows = [];
        res.forEach((item, i) => {
            if (item['_source']['type'] === 'customer') {
                rows.push(createListDataCustomer(item['_source']));
            }
        });
        return getUniqueFromArrayByKey(rows, 'id');
    }

    getCustomer(callback) {
        this.props.dispatch({ type: GET_CUSTOMER_LIST_REQUEST });
        if (this.userAWSAttributes && this.userAWSAttributes['custom:org_id'] && this._isMounted) {
            loadCustomers(this.userAWSAttributes['custom:org_id']).then(res => {
                if (this._isMounted) {
                    if (res && res.length >= 0) {
                        this.props.dispatch({ type: GET_CUSTOMER_LIST_SUCCESS });
                        this.setState({ customers: this.formatCustomerList(res) });
                        ManageLocalStorage.set("customerList", res);
                        if (callback) {
                            callback();
                        }
                    } else {
                        this.props.dispatch({ type: GET_CUSTOMER_LIST_FAILED });
                    }
                }
            }).catch((e) => {
                this.props.dispatch({
                    type: GET_CUSTOMER_LIST_FAILED,
                    error: e.message
                });
            });
        }
    }

    searchCustomer(searchKey) {
        ManageLocalStorage.delete("customerSearchKey");
        if (searchKey.length) {
            this.setState({ customers: [] });
            this.setState({ searchResult: [] });
            this.props.dispatch({ type: GET_CUSTOMER_LIST_REQUEST });
            let payload = {
                search: searchKey
            };
            searchCustomers(payload).then(res => {
                if (this._isMounted) {
                    this.props.dispatch({ type: GET_CUSTOMER_LIST_SUCCESS });
                    if (res.result && res.result.length > 0) {
                        let tempList = this.formatCustomerListES(res.result);
                        if (tempList.length > 0) {
                            ManageLocalStorage.set("customerSearchKey", searchKey);
                            this.setState({ searchResult: tempList });
                        } else {
                            openSnackbar({
                                message: "No Results Found !!",
                                variant: "info"
                            });
                        }
                    }
                    else if (res && res.length > 0) {
                        ManageLocalStorage.set("customerSearchKey", searchKey);
                        this.setState({ searchResult: this.formatCustomerList(res) });
                    } else {
                        openSnackbar({
                            message: "No Results Found !!",
                            variant: "info"
                        });
                    }
                }
            }).catch((e) => {
                this.props.dispatch({
                    type: GET_CUSTOMER_LIST_FAILED,
                    error: e.message
                });
            });
        } else {
            if (this._isMounted) {
                this.setState({ customers: [] });
                this.setState({ searchResult: [] });
                this.events.getCustomer();
            }
        }
    }

    navigate(menu) {
        history.push(menu);
    }

    componentDidMount() {
        this._isMounted = true;
        try {
            this.props.dispatch(
                setFloatBtnData({
                    floatBtnData: {
                        currentComponent: 'customer_list'
                    }
                })
            );
            this.userAWSAttributes = JSON.parse(ManageLocalStorage.get("userAWSAttributes"));
            if (!ManageLocalStorage.get("customerSearchKey")) {
                this.events.getCustomer();
            }
        }
        catch (e) {
        }
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    render() {
        return (
            <>
                {
                    <CustomerList customers={this.state.customers} searchResult={this.state.searchResult} getCustomerDetailAction={this.events.getCustomerDetailAction}
                        searchCustomerAction={this.events.searchCustomer} />
                }
            </>
        );
    }
}

const mapStateToProps = state => {
    return { state };
};

export default connect(mapStateToProps)(CustomerListContainer);