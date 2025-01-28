import React, { Component } from "react";
import mainLogo from '../../Assets/images/logo.png';
import { history } from "../../Core/Store";

class Login extends Component {
    constructor(props) {
        super(props);
        this.state = {
            username: "",
            password: "",
            username_undefined: false,
            password_undefined: false
        };
        this.onLogin = this.onLogin.bind(this);
        this.getInput = this.getInput.bind(this);
        this.closeFeedback = this.closeFeedback.bind(this);
    }
    navigate(menu) {
        history.push(menu);
    }
    getInput(event) {
        this.setState({ [event.target.name]: event.target.value });
    }

    onLogin(event) {
        event.preventDefault();
        this.setState({
            username_undefined: this.state.username === "" ? true : false,
            password_undefined: this.state.password === "" ? true : false
        });
        if (this.state.username === "" || this.state.password === "") {
            return;
        }
        this.props.onLoginClick(this.state.username, this.state.password);
    }

    closeFeedback() {
        this.setState({ username_undefined: false, password_undefined: false });
    }

    render() {
        return (
            <div className="row h-100 justify-content-center align-items-center">
                <div className="col-12 col-md-6 col-lg-5 col-xl-4">
                    <div className="bg-white box-shadow h-100 p-5 align-items-center px-3 mx-3">
                        <div className="text-center">
                            <span className="h-100 py-2" onClick={() => this.navigate('/login')}>
                                <img alt="altValue" className="img-fluid" src={mainLogo} />
                            </span>
                        </div>
                        <div className="text-center Login mt-3">
                            {(this.state.username_undefined ||
                                this.state.password_undefined) && (
                                    <div className="feedback">
                                        <span className="feed-close" onClick={this.closeFeedback}>
                                            <i className="icon-close" />
                                        </span>
                                        {this.state.username_undefined && (
                                            <span>Please enter a Username <br /></span>
                                        )}

                                        {this.state.password_undefined && (
                                            <span>Please enter a Password</span>
                                        )}
                                    </div>
                                )}
                            <form onSubmit={this.onLogin}>
                                <div className="login-form pt-10 mb-4">                                    
                                    <input type="email" className="form-control form-control-lg text-center"
                                        placeholder="Username" name="username" autoComplete="old-email"
                                        onChange={this.getInput} />
                                </div>
                                <div className="login-form pt-10 mb-4">
                                    <input type="password" className="form-control form-control-lg text-center"
                                        placeholder="Password" name="password" autoComplete="old-password"
                                        onChange={this.getInput} />
                                </div>
                                {/* <div className="login-form pt-10 mb-4">
                                    <span className="text-muted">New User?</span>
                                    <span className="anchorSpan pl-1" onClick={() => this.navigate('/signup')}>Sign Up</span>
                                </div> */}
                                <div className="text-center pt-10">                                    
                                    <button type="submit" className="btn btn-primary btn-lg">Login</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default Login;
