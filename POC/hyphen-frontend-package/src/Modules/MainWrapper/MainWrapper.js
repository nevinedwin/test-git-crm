import React, { Component } from "react";
import { connect } from "react-redux";
import { makeStyles } from '@material-ui/core/styles';

import {
  loadingSelector,
  notificationSelector
} from "../../Services/Selectors";
import { history } from "../../Core/Store";
import { locStrings } from "../../Services/Localization";
import { ManageLocalStorage } from "../../Services/LocalStorage";

import Loader from "../../Shared/Components/Loader";
import Header from "../../Shared/Components/Header";
import FloatBtn from "../../Shared/Components/FloatBtn";
import ErrorGrowl from "../../Shared/Components/Error";
import { setListData } from '../../Actions/ListData';
import Notifier from '../../Shared/Components/Notifier';

import { loadPropertyList, loadCustomerDetails } from '../../Services/CustomerService';
import {
  GET_PROPERTY_LIST_REQUEST,
  GET_PROPERTY_LIST_SUCCESS,
  GET_PROPERTY_LIST_FAILED,
  LOGIN_SUCCESS
} from '../../Utilities/Constants';
import { clearStorageAndAmplify } from '../../Utilities/Utils';

import _ from "lodash";

let loadingSelectorCollection = loadingSelector([
  "LOGIN",
  "SIGNUP",
  "GET_CUSTOMER_LIST",
  "GET_CUSTOMER_DETAIL"
]);

let errorSelectorCollection = notificationSelector([
  "LOGIN",
  "SIGNUP",
  "GET_CUSTOMER_LIST",
  "GET_CUSTOMER_DETAIL"
]);

const useStyles = makeStyles(theme => ({
  loaderRoot: {
    flexGrow: 1,
  },
  snackBarclose: {
    padding: theme.spacing(0.5),
  }
}));

class MainWrapper extends Component {
  _isMounted = false;
  componentUpdateInProgress = false;
  componentUpdateInProgress2 = false;
  userAWSAttributes = '';
  constructor(props) {
    super(props);
    this.state = {
      loadChildren: false
    };
  }

  navigate(menu) {
    history.push(menu);
  }

  getPropertyLists() {
    this.props.dispatch({ type: GET_PROPERTY_LIST_REQUEST });
    loadPropertyList(this.userAWSAttributes['custom:org_id']).then(res => {
      this.props.dispatch({ type: GET_PROPERTY_LIST_SUCCESS });
      if (res && res.length >= 0) {
        res.forEach((element, index) => {
          res[index].checked = false;
        });
        if (this._isMounted) {
          let tempData = {
            listDatas: {
              influenceList: [
                { id: 1, "name": "Twitter", checked: false },
                { id: 2, "name": "LinkedIn", checked: false },
                { id: 3, "name": "Website", checked: false },
                { id: 4, "name": "Billboard", checked: false }
              ],
              desiredFeaturesList: [
                { id: 1, "name": "3 Stories", checked: false },
                { id: 2, "name": "6 Bedrooms", checked: false },
                { id: 3, "name": "1 Garage", checked: false },
                { id: 4, "name": "1 Formal Living Room", checked: false },
                { id: 5, "name": "1 Study", checked: false },
                { id: 6, "name": "1 Game Room", checked: false }
              ],
              stageList: ['Lead', 'Prospect', 'Buyer', 'Bust Out', 'Closed', 'Dead Lead'],
              desiredMoveList: ['As soon as possible', '2-3 Months', 'Over 3 Months'],
              contactMethodList: ['Text', 'Email', 'Phone'],
              realtorList: ['Dave Zajdzinski - eXp Reality', 'John - eXp Reality', 'Zack - eXp Reality'],
              sourceList: ['Walk-In', 'Web', 'Facebook'],
              gradeList: ['A+', 'A', 'B', 'C', 'D'],
              propertyLists: res
            }
          };



          if (!ManageLocalStorage.get("listData")) {
            ManageLocalStorage.set("listData", tempData.listDatas);
          }

          if (_.isEmpty(this.props.listData)) {
            this.props.dispatch(
              setListData(tempData)
            );
          }
        }
      } else {
        this.props.dispatch({ type: GET_PROPERTY_LIST_FAILED });
      }
      this.componentUpdateInProgress = false;
    }).catch((error) => {
      this.componentUpdateInProgress = false;
    });
  }

  updateLoggedInUserDetails() {
    let userDetailsTemp = JSON.parse(ManageLocalStorage.get("userDetails"));
    if (this.props.isLoggedIn && !this.componentUpdateInProgress2 && !userDetailsTemp && _.isEmpty(this.props.userDetails) && this.userAWSAttributes) {
      this.componentUpdateInProgress2 = true;
      loadCustomerDetails(this.userAWSAttributes['sub'], this.userAWSAttributes['custom:org_id'], 'agent').then(userDetails => {
        if (userDetails.length && userDetails[0].id && userDetails[0].email) {
          ManageLocalStorage.set("userDetails", userDetails[0]);
          this.props.dispatch({
            type: LOGIN_SUCCESS,
            payload: {
              userDetails: userDetails[0]
            }
          });
        } else {
          ManageLocalStorage.set("userDetails", userDetails);
          this.props.dispatch({
            type: LOGIN_SUCCESS,
            payload: {
              userDetails
            }
          });
        }
        this.componentUpdateInProgress2 = false;
      }).catch((error) => {
        this.componentUpdateInProgress2 = false;
      });;
    }
  }

  componentDidMount() {
    this._isMounted = true;
    const userDetails = ManageLocalStorage.get("userDetails");
    this.userAWSAttributes = JSON.parse(ManageLocalStorage.get("userAWSAttributes"));
    locStrings.setLanguage("en");
    if (!userDetails || this.userAWSAttributes === '') {
      clearStorageAndAmplify();
      history.replace("/login");
    }

    // try {
    //   Auth.currentSession();
    // }
    // catch (e) {
    //   clearStorageAndAmplify();
    //   history.replace("/login");
    // }

    this.setState({ loadChildren: true });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.props.isLoggedIn && !this.componentUpdateInProgress && _.isEmpty(this.props.listData)) {
      this.componentUpdateInProgress = true;
      this.userAWSAttributes = JSON.parse(ManageLocalStorage.get("userAWSAttributes"));
      if (this.userAWSAttributes && this.userAWSAttributes['custom:org_id']) {
        this.getPropertyLists();
      }
    }
    this.updateLoggedInUserDetails();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    return (
      <>
        {this.props.isLoggedIn && (
          <Header
            user={this.props.user}
            {...this.props}
          />
        )}
        <div className={"page-wrapper h-100 " + (this.props.isLoggedIn ? 'page-wrapper-padding' : '')}>
          {this.state.loadChildren && this.props.children}
        </div>
        {this.props.floatBtnData.currentComponent !== 'customer_add' && this.props.isLoggedIn ? <FloatBtn data={this.props.floatBtnData} customerNew={() => this.navigate('/customer/new')} /> : ''}
        <Notifier />
      </>
    );
  }
}

const mapStateToProps = state => {
  return {
    isLoggedIn: state.login.isLoggedIn,
    isLoading: loadingSelectorCollection(state),
    classes: useStyles,
    error: errorSelectorCollection(state),
    userDetails: state.login.userDetails,
    errorMessage: state.error.errorMessage,
    listData: state.listReducer.listData,
    floatBtnData: state.floatBtnReducer.floatBtnData

  };
};

export default connect(mapStateToProps)(
  ErrorGrowl(Loader(MainWrapper))
);
