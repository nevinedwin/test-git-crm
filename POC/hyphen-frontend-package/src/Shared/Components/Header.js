
import { connect } from "react-redux";
import React, { Component } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import IconButton from '@material-ui/core/IconButton';
import Search from '@material-ui/icons/Search';
import Settings from '@material-ui/icons/Settings';
import NotificationsActive from '@material-ui/icons/NotificationsActive';
import { withStyles } from "@material-ui/core/styles";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import { history } from "../../Core/Store";
import { LOGOUT } from "../../Utilities/Constants";
import translate from "./TranslationHoc";

import '../../Assets/scss/Header.scss';
import avatar from '../../Assets/images/avatar.png';
import mainLogo from '../../Assets/images/logo.png';
import { clearStorageAndAmplify } from '../../Utilities/Utils';
// import Navbar from '../../Shared/Components/Navbar';

const StyledTabs = withStyles(theme => ({
    root: {
        minHeight: '64px'
    },
    indicator: {
        display: "flex",
        width: "101px !important",
        justifyContent: "center",
        backgroundColor: "transparent",
        "& > div": {
            width: "100%",
            backgroundColor: "#F37620"
        }
    }
}))(props => (
    <Tabs
        {...props}
        variant="fullWidth"
        centered
        TabIndicatorProps={{ children: <div /> }}
    />
));

const StyledTab = withStyles(theme => ({
    root: {
        textTransform: "none",
        minHeight: '64px',
        minWidth: '101px',
        fontWeight: theme.typography.fontWeightBold,
        fontSize: theme.typography.pxToRem(15),
        "&:hover": {
            color: "#F37620",
            opacity: 1
        },
        "&$selected": {
            color: "#F37620",
            fontWeight: theme.typography.fontWeightBold
        },
        "&:focus": {
            color: "#F37620"
        }
    },
    selected: {}
}))(props => <Tab {...props} />);


class Header extends Component {
    constructor(props) {
        super(props);
        this.onLogout = this.onLogout.bind(this);
        this.events = this.bindEvents();
        this.state = { nodes: [], currentTab: 0 };
        this.nodes = [];
        this.found = false;
    }

    bindEvents() {
        return {
            handleChange: this.handleChange.bind(this)
        };
    }

    isL1Route(node) {
        if (this.props.location.pathname.indexOf(node.apiRoute) !== -1) {
            return "active";
        } else {
            return "";
        }
    }
    isL2Route(node) {
        if (this.props.location.pathname === node.apiRoute) {
            return "current";
        } else {
            return "";
        }
    }

    onLogout() {
        clearStorageAndAmplify();
        this.props.dispatch({ type: LOGOUT });
        history.replace("/login");
        // // window.location.reload();
    }

    handleChange(event, newValue) {
        this.setState({ currentTab: newValue });
    }

    createMainMenu() {

        return (
            <>
                {/* <Navbar {...this.props} style={{ marginTop: '71px' }} /> */}
                <nav className="navbar navbar-light navbar-expand-md bg-white topbar fixed-top shadow flex-row">
                    <div className="navbar-brand py-2 cursor-pointer" onClick={() => { history.push("/customer/customerlist") }}>
                        <img alt="altValue" className="img-fluid" src={mainLogo} />
                    </div>
                    <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="navbarSupportedContent">
                        {/* <ul className="page-nav navbar-nav mx-auto h-md-100  justify-content-center justify-md-content-flex-start">
                        <li className="active">Customers</li>
                        <li>Realtors &reg;</li>
                        <li>Campaigns</li>
                    </ul> */}
                        <StyledTabs value={this.state.currentTab} onChange={this.events.handleChange} className="page-nav navbar-nav mx-auto h-md-100  justify-content-center justify-md-content-flex-start">
                            <StyledTab label="Customers" />
                            <StyledTab label="Realtors &reg;" />
                            <StyledTab label="Campaigns" />
                        </StyledTabs>
                        <ul className="navbar-nav d-flex align-items-center justify-content-center justify-md-content-flex-start">
                            <li className="nav-item dropdown no-arrow">
                                <div className="nav-link px-0 px-lg-1">
                                    <IconButton onClick={() => { history.push("/search") }}>
                                        <Search />
                                    </IconButton>
                                </div>
                            </li>
                            <li className="nav-item dropdown no-arrow">
                                <div className="nav-link px-0 px-lg-1">
                                    <IconButton>
                                        <Settings />
                                    </IconButton>
                                </div>
                            </li>
                            <li className="nav-item dropdown no-arrow mr-2">
                                <div className="nav-link px-0 px-lg-1">
                                    <IconButton>
                                        <NotificationsActive />
                                    </IconButton>
                                    <span className="indicator"></span>
                                </div>
                            </li>
                            <li className="nav-item dropdown user-drop no-arrow">
                                <div className="nav-link dropdown-toggle d-flex align-items-center pr-0" id="userDropdown" role="button" data-toggle="dropdown"
                                    aria-haspopup="true" aria-expanded="false">
                                    <div className="user-avatar mr-0 mr-lg-2">
                                        <img alt="altValue" className="img-profile rounded-circle" src={avatar} />
                                    </div>
                                    <span className="mr-2 d-none d-lg-inline font-weight-bold user-name">{this.props.userDetails.fname} {this.props.userDetails.lname}</span>
                                </div>
                                <div className="dropdown-menu dropdown-menu-right shadow animated--grow-in animation slideUpIn" aria-labelledby="userDropdown">
                                    <div className="dropdown-item">
                                        <FontAwesomeIcon style={{}} icon="user" size="sm" fixedWidth className="mr-2 text-muted" />
                                        Profile
                                </div>
                                    <div className="dropdown-item">
                                        <FontAwesomeIcon style={{}} icon="cogs" size="sm" fixedWidth className="mr-2 text-muted" />
                                        Settings
                                </div>
                                    <div className="dropdown-item">
                                        <FontAwesomeIcon style={{}} icon="list" size="sm" fixedWidth className="mr-2 text-muted" />
                                        Activity Log
                                </div>
                                    <div className="dropdown-divider"></div>
                                    <div className="dropdown-item" data-toggle="modal" data-target="#logoutModal" onClick={this.onLogout}>
                                        <FontAwesomeIcon style={{}} icon="sign-out-alt" size="sm" fixedWidth className="mr-2 text-muted" />
                                        {this.props.strings.logOut}
                                    </div>
                                </div>
                            </li>
                        </ul>
                    </div>
                </nav>
            </>
        );
    }

    render() {
        return this.createMainMenu();
    }
}

const mapStateToProps = state => {
    return {
        location: state.router.location,
        user: state.login.user,
        userDetails: state.login.userDetails
    };
};

const WithTranslation = translate("common")(Header);
export default connect(mapStateToProps)(WithTranslation);
