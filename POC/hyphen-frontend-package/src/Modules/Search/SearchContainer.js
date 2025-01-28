import { connect } from "react-redux";
import React, { Component } from "react";

import Search from './Search';
import { ManageLocalStorage } from "../../Services/LocalStorage";
import { setFloatBtnData } from '../../Actions/FloatBtn';
import {
    GET_CUSTOMER_LIST_REQUEST,
    GET_CUSTOMER_LIST_SUCCESS,
    GET_CUSTOMER_LIST_FAILED
} from '../../Utilities/Constants';
import { openSnackbar } from '../../Shared/Components/Notifier';
import { searchApplication } from '../../Services/CustomerService';
import './search.scss';

class SearchContainer extends Component {
    userAWSAttributes = {};
    _isMounted = false;
    constructor(props, context) {
        super(props, context);
        this.events = this.bindEvents();
        this.state = {
            searchResult: {
                fnameList: [],
                lnameList: [],
                emailList: [],
                phoneList: []
            }
        };
    }

    bindEvents() {
        return {
            searchAppAction: this.searchAppAction.bind(this)
        };
    }

    processSearch(list) {
        let tempRows = [];
        list.forEach((item, i) => {
            Object.keys(item.highlight).forEach(function (key) {
                if (item['_source'].type === 'agent' && key.includes('acti.')) {
                    delete item.highlight[key];
                }
            });
            if (Object.keys(item.highlight).length) {
                tempRows.push(item);
            }
        });
        return tempRows;
    }

    searchAppAction(searchKey) {
        ManageLocalStorage.delete("globalSearchKey");
        if (searchKey.length) {
            this.setState({ searchResult: [] });
            this.props.dispatch({ type: GET_CUSTOMER_LIST_REQUEST });
            let payload = {
                search: searchKey
            };
            searchApplication(payload).then(res => {
                if (this._isMounted) {
                    this.props.dispatch({ type: GET_CUSTOMER_LIST_SUCCESS });
                    if (res.result && res.result.length > 0) {
                        let resultTemp = this.processSearch(res.result);
                        ManageLocalStorage.set("globalSearchKey", searchKey);
                        this.setState({ searchResult: resultTemp });
                    }
                    else {
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
            this.setState({ searchResult: [] });
        }
    }

    componentDidMount() {
        this._isMounted = true;
        try {
            this.props.dispatch(
                setFloatBtnData({
                    floatBtnData: {
                        currentComponent: 'search'
                    }
                })
            );
            this.userAWSAttributes = JSON.parse(ManageLocalStorage.get("userAWSAttributes"));
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
                    <Search searchApp={this.events.searchAppAction} searchResult={this.state.searchResult} />
                }
            </>
        );
    }
}

const mapStateToProps = state => {
    return { state };
};

export default connect(mapStateToProps)(SearchContainer);