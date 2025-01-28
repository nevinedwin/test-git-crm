import React, { Component } from "react";
import { connect } from "react-redux";

import LoginComponent from "./Login";
import { loginRequest } from "../../Actions/Login";
import { history } from "../../Core/Store";
import { setFloatBtnData } from '../../Actions/FloatBtn';
import { clearStorageAndAmplify } from '../../Utilities/Utils';

import './Login.scss';

class LoginContainer extends Component {
    constructor(props) {
        super(props);
        this.events = this.bindEvents();
    }

    bindEvents() {
        return {
            loginAction: this.loginAction.bind(this)
        };
    }

    loginAction(username, password) {
        this.props.dispatch(
            loginRequest({ Username: username, Password: password })
        );
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.isLoggedIn) {
            history.replace("/customer/customerlist");
        }
    }

    componentDidMount() {
        this.props.dispatch(
            setFloatBtnData({
                floatBtnData: {
                    currentComponent: 'login'
                }
            })
        );
        clearStorageAndAmplify();
    }

    render() {
        return <LoginComponent onLoginClick={this.events.loginAction} />;
    }
}

const mapStateToProps = state => {
    return {
        isLoggedIn: state.login.isLoggedIn
    };
};

export default connect(mapStateToProps)(LoginContainer);
