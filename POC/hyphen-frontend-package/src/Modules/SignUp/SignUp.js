import React, { Component } from "react";

class SignUp extends Component {
    constructor(props) {
        super(props);

        this.state = {
            isLoading: false,
            email: "",
            lname: "",
            fname: "",
            password: "",
            confirmPassword: "",
            confirmationCode: "",
            homeBuilder: ""
        };
    }

    validateForm() {
        return (
            this.state.email.length > 0 &&
            this.state.homeBuilder.length > 0 &&
            this.state.password.length > 0 &&
            this.state.password === this.state.confirmPassword
        );
    }

    validateConfirmationForm() {
        return this.state.confirmationCode.length > 0;
    }

    handleChange = event => {
        this.setState({
            [event.target.id]: event.target.value
        });
    }

    handleSubmit = event => {
        event.preventDefault();
        let homeBuilderId = '';
        if (this.state.homeBuilder === "") {
            homeBuilderId = this.props.homeBuilderList[0]['id'];
        }
        let signUpData = {
            username: this.state.email,
            password: this.state.password,
            org_id: homeBuilderId,
            lname: this.state.lname,
            fname: this.state.fname,
        }
        this.props.onSignUpClick(signUpData);
    }

    handleConfirmationSubmit = event => {
        event.preventDefault();
        this.props.onConfirmationClick(this.state.email, this.state.password, this.state.confirmationCode);
    }


    renderConfirmationForm() {
        return (
            <form onSubmit={this.handleConfirmationSubmit}>
                <div className="form-group">
                    <label htmlFor="confirmationCode">Confirmation Code</label>
                    <input type="tel" className="form-control" id="confirmationCode"
                        autoFocus
                        value={this.state.confirmationCode}
                        onChange={this.handleChange} />
                    <small>Please check your email for the code.</small>
                </div>
                <button type="submit" className="btn btn-primary">Submit</button>
            </form>
        );
    }


    renderForm() {
        return (
            <form onSubmit={this.handleSubmit}>
                <div className="form-group">
                    <label htmlFor="fname">First Name</label>
                    <input type="fname" className="form-control" id="fname"
                        autoFocus
                        required
                        value={this.state.fname}
                        onChange={this.handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="lname">Last Name</label>
                    <input type="lname" className="form-control" id="lname"
                        required
                        value={this.state.lname}
                        onChange={this.handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input type="email" className="form-control" id="email"
                        required autoComplete="new-email"
                        value={this.state.email}
                        onChange={this.handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="homeBuilder">Home Builder</label>
                    <select className="form-control" id="homeBuilder"
                        required
                        value={this.state.homeBuilder}
                        onChange={this.handleChange}>
                        {
                            this.props.homeBuilderList &&
                            this.props.homeBuilderList.map(function (group) {
                                return <option key={group.id} value={group.id}>{group.name}</option>
                            })
                        }
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password:</label>
                    <input type="password" className="form-control" id="password"
                        required autoComplete="new-password"
                        value={this.state.password}
                        onChange={this.handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input type="password" className="form-control" id="confirmPassword"
                        required autoComplete="confirm-password"
                        value={this.state.confirmPassword}
                        onChange={this.handleChange} />
                </div>
                <button type="submit" className="btn btn-primary">Submit</button>
            </form>
        );
    }

    render() {
        return (
            <div className="Signup">
                {this.props.newUser === null
                    ? this.renderForm()
                    : this.renderConfirmationForm()}
            </div>
        );
    }
}

export default SignUp;
