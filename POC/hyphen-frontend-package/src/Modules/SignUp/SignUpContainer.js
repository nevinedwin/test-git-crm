import React, { Component } from "react";
import { connect } from "react-redux";
import { Auth } from "aws-amplify";

import SignUpComponent from "./SignUp";
import { history } from '../../Core/Store';
import { SIGNUP_REQUEST, SIGNUP_SUCCESS, SIGNUP_FAILED } from "../../Utilities/Constants";
import { signUp } from '../../Services/CustomerService';
import { loadHomeBuilderList } from '../../Services/CustomerService';
import { setFloatBtnData } from '../../Actions/FloatBtn';

import './SignUp.scss'

class SignUpContainer extends Component {
    _isMounted = false;
    constructor(props) {
        super(props);
        this.events = this.bindEvents();
        this.state = {
            newUser: null
        };
    }

    bindEvents() {
        return {
            SignUpAction: this.SignUpAction.bind(this),
            confirmationAction: this.confirmationAction.bind(this),
            getHomeBuilderList: this.getHomeBuilderList.bind(this)
        };
    }

    async SignUpAction(signUpData) {
        this.props.dispatch({ type: SIGNUP_REQUEST });
        try {
            const newUser = await Auth.signUp({
                username: signUpData.username,
                password: signUpData.password,
                attributes: {
                    'custom:org_id': signUpData.org_id
                }
            });
            if (this._isMounted) {
                this.setState({
                    newUser
                });
            }
            signUp({
                org_id: signUpData.org_id,
                user_id: newUser.userSub,
                email: signUpData.username,
                lname: signUpData.lname,
                fname: signUpData.fname,
                type: 'agent'
            }).then(res => { });
            this.props.dispatch({ type: SIGNUP_SUCCESS });
        } catch (e) {
            this.props.dispatch({
                type: SIGNUP_FAILED,
                error: e.message
            });
        }
    }

    async confirmationAction(email, password, confirmationCode) {
        this.props.dispatch({ type: SIGNUP_REQUEST });
        try {
            await Auth.confirmSignUp(email, confirmationCode);
            this.props.dispatch({ type: SIGNUP_SUCCESS });
            history.replace("/login");
        } catch (e) {
            this.props.dispatch({ type: SIGNUP_FAILED });
        }
    }

    async getHomeBuilderList(callback) {
        this.props.dispatch({ type: SIGNUP_REQUEST });
        await loadHomeBuilderList().then(res => {
            this.props.dispatch({ type: SIGNUP_SUCCESS });
            if (res && res.length >= 1) {
                if (this._isMounted) {
                    this.setState({ homeBuilderList: res });
                }
                if (callback) {
                    callback();
                }
            } else {
                this.props.dispatch({ type: SIGNUP_FAILED });
            }
        }).catch((e) => {
            this.props.dispatch({
                type: SIGNUP_FAILED,
                error: e.message
            });
        });
    }

    componentDidMount() {
        this._isMounted = true;
        this.props.dispatch(
            setFloatBtnData({
                floatBtnData: {
                    currentComponent: 'signup'
                }
            })
        );
        this.events.getHomeBuilderList();
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    render() {
        return (
            <SignUpComponent
                homeBuilderList={this.state.homeBuilderList}
                onSignUpClick={this.events.SignUpAction}
                onConfirmationClick={this.events.confirmationAction}
                newUser={this.state.newUser} />
        );
    }
}

const mapStateToProps = state => {
    return { state };
};

export default connect(mapStateToProps)(SignUpContainer);
