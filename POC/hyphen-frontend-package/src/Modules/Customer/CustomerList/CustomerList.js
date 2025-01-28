import React, { Component } from "react";
import DataTableMaterial from "../../../Shared/Components/DataTable";
import SearchBtn from '../../../Shared/Components/Search';

class CustomerList extends Component {

    constructor(props, context) {
        super(props, context);
        this.events = this.bindEvents();
    }

    bindEvents() {
        return {
            getCustomerDetail: this.getCustomerDetail.bind(this),
            searchCustomer: this.searchCustomer.bind(this)
        };
    }

    getCustomerDetail(customerItem) {
        this.props.getCustomerDetailAction(customerItem);
    }

    searchCustomer(searchKey) {
        this.props.searchCustomerAction(searchKey);
    }

    render() {
        return (
            <div className="px-4 pt-4 pb-3">
                <div className="pagehead d-flex justify-content-md-between align-items-md-center flex-md-row flex-column">
                    <h4 className="font-weight-extra-bold mb-3 mb-md-0">Customers ({this.props.searchResult.length ? this.props.searchResult.length : this.props.customers.length})</h4>
                    <SearchBtn
                        placeHolder="Search"
                        storageKey="customerSearchKey"
                        onChangeSearchAction={this.events.searchCustomer}
                        resultLength={this.props.searchResult.length}
                        alternateListLength={this.props.customers.length} />
                </div>

                {this.props.customers.length > 0 && <DataTableMaterial rows={this.props.customers}
                    customerDetail={this.events.getCustomerDetail} />}
                {this.props.searchResult.length > 0 && <DataTableMaterial rows={this.props.searchResult}
                    customerDetail={this.events.getCustomerDetail} />}
            </div>
        );
    }
}

export default CustomerList;
