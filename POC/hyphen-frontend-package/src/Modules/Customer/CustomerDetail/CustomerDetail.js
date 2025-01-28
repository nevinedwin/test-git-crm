import React, { Component } from "react";
import _ from "lodash";
import { withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import FavoriteBorder from '@material-ui/icons/FavoriteBorder';
import Favorite from '@material-ui/icons/Favorite';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import IconButton from '@material-ui/core/IconButton';
import Close from '@material-ui/icons/Close';
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';
import Fab from '@material-ui/core/Fab';
import Box from '@material-ui/core/Box';
import DeleteRoundedIcon from '@material-ui/icons/DeleteRounded';
import Edit from '@material-ui/icons/Edit';
import MenuItem from "@material-ui/core/MenuItem";

import DrawerMUI from '../../../Shared/Components/Drawer';
import { toggleDrawerMUI } from '../../../Shared/Components/Drawer';
import avatar from '../../../Assets/images/avatar.png';
import ContentEditable from '../../../Shared/Components/ContentEditable';
import CheckboxList from '../../../Shared/Components/CheckBoxList';
import SelectBox from '../../../Shared/Components/SelectBox';
import RadioBox from '../../../Shared/Components/RadioBox';
import EventListView from '../../../Shared/Components/TimeLine/EventListView';
import PopOverMUI from '../../../Shared/Components/PopOver';
import ConfirmationDialog from '../../../Shared/Components/Confirmation';
import MoreBtn from '../../../Shared/Components/MoreBtn';
import { randomNumberBtwn } from '../../../Utilities/Utils';

const FabBtn = withStyles(theme => ({
    root: {
        color: '#fff',
        backgroundColor: '#219FF4',
        width: '30px',
        height: '30px',
        minHeight: '0',
        marginLeft: '-30px',
        '&:hover': {
            backgroundColor: '#199ff9',
        },
    },
}))(Fab);

const ColorButton = withStyles(theme => ({
    label: {
        display: 'flex',
        flexDirection: 'column'
    }
}))(Button);

const MenuItemCustom = withStyles(theme => ({
    root: {
        paddingLeft: '5px'
    },
}))(MenuItem);


class CustomerDetail extends Component {
    _isMounted = false;
    stageIconStyle = { color: "#ffffff", marginTop: '-0.2rem' };
    constructor(props, context) {
        super(props, context);
        this.events = this.bindEvents();
        this.state = {
            customerDetail: _.cloneDeep(this.props.customerDetail),
            propertyLists: _.cloneDeep(this.props.propertyLists),
            influenceList: _.cloneDeep(this.props.influenceList),
            desiredFeaturesLists: _.cloneDeep(this.props.desiredFeaturesLists),
            stageList: _.cloneDeep(this.props.stageList),
            desiredMoveList: _.cloneDeep(this.props.desiredMoveList),
            contactMethodList: _.cloneDeep(this.props.contactMethodList),
            gradeList: _.cloneDeep(this.props.gradeList),
            realtorList: _.cloneDeep(this.props.realtorList),
            checkBoxError: true,
            popOverElements: {
                interestEl: null,
                influenceEl: null,
                realtorEl: null
            },
            activityIsOpen: false,
            editCustomerViewClass: '',
            activityClass: 'collapsed',
            customerStageClass: '',
            customerStageIcon: <FontAwesomeIcon style={this.stageIconStyle} icon="question-circle" />,
            activityDrawerClass: '',
            mobileView: '',
            openUpdateCustomerConfirmationDialog: false,
            openDeleteCustomerConfirmationDialog: false,
            currentUpdateEvent: '',
            confirmKey: randomNumberBtwn(),
            deleteConfirmKey: randomNumberBtwn(),
            sectionKey: {
                'fname': randomNumberBtwn(),
                'lname': randomNumberBtwn(),
                'stage': randomNumberBtwn(),
                'inte': randomNumberBtwn(),
                'infl': randomNumberBtwn(),
                'rltr': randomNumberBtwn(),
                'cntm': randomNumberBtwn(),
                'desf': randomNumberBtwn(),
                'desm': randomNumberBtwn()
            },
            favoriteToggle: false,
            menuItemClicked: randomNumberBtwn()
        };
    }
    bindEvents() {
        return {
            onUpdateField: this.onUpdateField.bind(this),
            deleteCustomer: this.deleteCustomer.bind(this),
            toggleEditCustomer: this.toggleEditCustomer.bind(this),
            updateFormAction: this.updateFormAction.bind(this),
            toggleActivity: this.toggleActivity.bind(this),
            activityDrawerToggle: this.activityDrawerToggle.bind(this),
            confirmationOk: this.confirmationOk.bind(this),
            confirmationCancel: this.confirmationCancel.bind(this)
        };
    }

    toggleActivity() {
        if (this.state.activityIsOpen) {
            this.setState({ activityClass: 'collapsed' });
            this.setState({ activityIsOpen: !this.state.activityIsOpen });
        } else {
            this.setState({ activityClass: '' });
            this.setState({ activityIsOpen: !this.state.activityIsOpen });
        }
    }

    toggleEditCustomer(item) {
        this.setState({ editCustomerViewClass: item });
    }

    setStageClass(stage) {
        switch (stage) {
            case 'Lead':
                this.setState({ customerStageClass: 'theme-lead' });
                this.setState({ customerStageIcon: <FontAwesomeIcon style={this.stageIconStyle} className="icon" icon="male" /> });
                break;
            case 'Prospect':
                this.setState({ customerStageClass: 'theme-prospect' });
                this.setState({ customerStageIcon: <FontAwesomeIcon style={this.stageIconStyle} className="icon" icon="address-card" /> });
                break;
            case 'Buyer':
                this.setState({ customerStageClass: 'theme-buyer' });
                this.setState({ customerStageIcon: <span className="icon icon-buyer"></span> });
                break;
            case 'Bust Out':
                this.setState({ customerStageClass: 'theme-bustout' });
                this.setState({ customerStageIcon: <span className="icon icon-bustout"></span> });
                break;
            case 'Closed':
                this.setState({ customerStageClass: 'theme-closed' });
                this.setState({ customerStageIcon: <FontAwesomeIcon style={this.stageIconStyle} className="icon" icon="home" /> });
                break;
            case 'Dead Lead':
                this.setState({ customerStageClass: 'theme-deadlead' });
                this.setState({ customerStageIcon: <FontAwesomeIcon style={this.stageIconStyle} className="icon" icon="user-slash" /> });
                break;
            default:
                break;
        }
    }

    resize() {
        if (this._isMounted) {
            if ((window.innerWidth >= 768 && window.innerWidth <= 1200)) {
                this.setState({ activityIsOpen: false });
                this.setState({ activityClass: 'collapsed' });
                this.setState({ activityDrawerClass: 'open-drawer' });
            } else {
                this.setState({ activityIsOpen: true });
                this.setState({ activityClass: '' });
                this.setState({ activityDrawerClass: 'close-drawer' });
            }
            if (window.innerWidth <= 767) {
                this.setState({ mobileView: true });
            } else {
                this.setState({ mobileView: false });
            }
        }
    }

    activityDrawerToggle(drawerClassName) {
        // this.setState({ activityDrawerClass: drawerClassName });
        if (drawerClassName === 'open-drawer') {
            toggleDrawerMUI(true);
        } else {
            toggleDrawerMUI(false);
        }
    }

    updateFormAction(value, name) {
        let event = {
            target: {
                name,
                value
            }
        };
        this.events.onUpdateField(event)
    }

    onUpdateField(event) {
        this.setState({ currentUpdateEvent: event }, () => {
            // this.setState({ openUpdateCustomerConfirmationDialog: true }, () => {
            //     this.setState({ confirmKey: randomNumberBtwn() });
            // });
            this.events.confirmationOk('customer_update');
        });

    }

    deleteCustomer(event) {
        this.setState({ openDeleteCustomerConfirmationDialog: true }, () => {
            this.setState({ deleteConfirmKey: randomNumberBtwn() });
        });
    }

    confirmationCancel(action) {
        switch (action) {
            case 'customer_update':
                this.setState({ openUpdateCustomerConfirmationDialog: false });
                this.setState({ currentUpdateEvent: '' });
                // this.props.reloadDetailComponent();
                let sectionKey = { ...this.state.sectionKey };
                sectionKey[this.state.currentUpdateEvent.target.name] = randomNumberBtwn();
                this.setState({ sectionKey });
                break;
            case 'customer_delete':
                this.setState({ openDeleteCustomerConfirmationDialog: false });
                break;
            default:
                break;
        }
    }

    confirmationOk(action) {
        switch (action) {
            case 'customer_update':
                let customerDetail = { ...this.state.customerDetail };
                if (this.state.currentUpdateEvent.target.value) {
                    customerDetail = { ...this.state.customerDetail, [this.state.currentUpdateEvent.target.name]: this.state.currentUpdateEvent.target.value };
                }
                switch (this.state.currentUpdateEvent.target.name) {
                    case 'inte':
                        this.setState({ propertyLists: this.state.currentUpdateEvent.target.value });
                        this.setState({ customerDetail });
                        break;
                    case 'infl':
                        this.setState({ influenceList: this.state.currentUpdateEvent.target.value });
                        this.setState({ customerDetail });
                        break;
                    case 'rltr':
                        this.setState({ realtorList: this.state.currentUpdateEvent.target.value });
                        this.setState({ customerDetail });
                        break;
                    case 'desf':
                        this.setState({ desiredFeaturesLists: this.state.currentUpdateEvent.target.value });
                        this.setState({ customerDetail });
                        break;
                    case 'desm':
                        this.setState({ customerDetail });
                        break;
                    case 'stage':
                        this.setStageClass(this.state.currentUpdateEvent.target.value);
                        break;
                    case 'fname':
                        this.setState({ customerDetail });
                        break;
                    case 'lname':
                        this.setState({ customerDetail });
                        break;
                    case 'email':
                        this.setState({ customerDetail });
                        break;
                    case 'phone':
                        this.setState({ customerDetail });
                        break;
                    default:
                        break;
                }
                this.props.updateProperties(this.state.currentUpdateEvent.target.name, this.state.currentUpdateEvent.target.value);
                this.setState({ openUpdateCustomerConfirmationDialog: false });
                break;
            case 'customer_delete':
                this.props.deleteCustomer();
                this.setState({ openDeleteCustomerConfirmationDialog: false });
                break;
            default:
                break;
        }
    }

    componentDidMount() {
        this._isMounted = true;
        this.setStageClass(this.state.customerDetail.stage);
        window.addEventListener("resize", this.resize.bind(this));
        this.resize();
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    render() {
        let EditableSpan = ContentEditable('span');
        let checkedInterests = [];
        let checkedInfluences = [];
        if (this.state.customerDetail.inte) {
            checkedInterests = (this.state.customerDetail.inte.filter(function (obj) {
                return obj.checked === true;
            }));
        }
        if (this.state.customerDetail.infl) {
            checkedInfluences = (this.state.customerDetail.infl.filter(function (obj) {
                return obj.checked === true;
            }));
        }
        let timeLineTemplate =
            (
                <div className="bg-white box-shadow timeline d-flex flex-column h-100">
                    <div className="d-flex py-3 px-3 activity-head align-items-center">
                        <FabBtn size="small" aria-label="Collapse" className="d-none d-md-flex" onClick={this.events.toggleActivity}>
                            {this.state.activityIsOpen ? <ChevronRight /> : <ChevronLeft />}
                        </FabBtn>
                        <h5 className="font-weight-bold mb-0 ml-md-3 flex-grow-1">Activity</h5>
                        <IconButton aria-label="Close" className="d-block d-md-none" onClick={() => this.events.activityDrawerToggle('close-drawer')}>
                            <Close />
                        </IconButton>
                    </div>
                    <div className="category-list">
                        <ul className="cs-actions-cat-list category-icon-wrap mx-auto h-100 pl-0 m-0 px-3">
                            <li className="active all-activity">
                                <div className="category-icon large d-flex justify-content-center align-items-center">
                                    <span className="icon icon-checked"></span>
                                </div></li>
                            <li className="mail">
                                <div className="category-icon large d-flex justify-content-center align-items-center">
                                    <span className="icon icon-mail"></span>
                                </div>
                            </li>
                            <li className="note">
                                <div className="category-icon large d-flex justify-content-center align-items-center">
                                    <span className="icon icon-note"></span>
                                </div>
                            </li>
                            <li className="calendar">
                                <div className="category-icon large d-flex justify-content-center align-items-center">
                                    <span className="icon icon-calendar"></span>
                                </div>
                            </li>
                            <li className="call">
                                <div className="category-icon large d-flex justify-content-center align-items-center">
                                    <span className="icon icon-call"></span>
                                </div>
                            </li>
                        </ul>
                        <hr className="category-divider mb-1 mt-0" />
                    </div>
                    <div className="flex-grow-1 scroll scroll-y pr-3 pl-2 py-3">
                        <EventListView events={this.state.customerDetail.acti} />
                    </div>
                </div>
            );
        return (
            <>
                {
                    this.state.propertyLists &&
                    this.state.customerDetail.acti &&
                    <div className="container-fluid px-0 h-100">
                        <div className={"d-flex flex-column flex-md-row h-100 detail-wrap " + this.state.customerStageClass}>
                            <div className="cs-left-panel">
                                <div className="bg-white box-shadow h-100">
                                    <div className="profile-section d-flex h-100 flex-column">
                                        <div className="profile-top-section d-flex justify-content-flex-start d-md-block text-center px-3 pb-md-1 pb-3 pt-md-3 pt-3">
                                            <div className="d-flex justify-content-between align-items-center order-3 order-md-1">
                                                <div className="profile-stage-ico">{this.state.customerStageIcon}</div>
                                                {
                                                    !this.state.mobileView &&
                                                    <IconButton className="ml-3 fav-button" title="Favorite" onClick={() => { this.setState({ favoriteToggle: !this.state.favoriteToggle }); }}>
                                                        {this.state.favoriteToggle ? <Favorite style={{ color: '#fff' }} /> : <FavoriteBorder style={{ color: '#fff' }} />}
                                                    </IconButton>
                                                }
                                            </div>
                                            <div className="user-pic mx-md-auto large mb-md-3">
                                                <img alt="altValue" className="img-profile rounded-circle" src={avatar} />
                                            </div>
                                            <div className="user-basic-details text-left text-md-center ml-3 ml-md-0 flex-grow-1">
                                                <h5 className="text-truncate mb-1 mb-md-2 font-weight-extra-bold">
                                                    {this.state.customerDetail.fname + ' ' + this.state.customerDetail.lname}
                                                </h5>
                                                <p>{this.state.customerDetail.email}</p>
                                                <p>{this.state.customerDetail.phone}</p>
                                            </div>
                                            <div className="profile-action-btns d-flex justify-content-end">
                                                {
                                                    (this.state.editCustomerViewClass === '' && !this.state.mobileView) ?
                                                        <IconButton className="edit-cstr" title="Edit Customer" onClick={() => { this.events.toggleEditCustomer('opened') }}>
                                                            <Edit style={{ color: '#fff' }} />
                                                        </IconButton> : ''
                                                }
                                                {
                                                    !this.state.mobileView &&
                                                    <IconButton className="delete-cstr" title="Delete Customer" onClick={this.events.deleteCustomer}>
                                                        <DeleteRoundedIcon style={{ color: '#fff' }} />
                                                    </IconButton>
                                                }
                                                {
                                                    this.state.mobileView &&
                                                    <MoreBtn bgColor={this.state.customerStageClass} key={this.state.menuItemClicked}>
                                                        <MenuItemCustom onClick={() => { this.setState({ favoriteToggle: !this.state.favoriteToggle }); }}>
                                                            <IconButton className="fav-button" title="Favorite">
                                                                {this.state.favoriteToggle ? <Favorite /> : <FavoriteBorder />}
                                                            </IconButton>
                                                            <span>Favorite</span>
                                                        </MenuItemCustom>
                                                        {
                                                            this.state.editCustomerViewClass === '' &&
                                                            <MenuItemCustom onClick={() => { this.setState({ menuItemClicked: randomNumberBtwn() }); this.events.toggleEditCustomer('opened'); }}>
                                                                <IconButton className="edit-cstr" title="Edit Customer">
                                                                    <Edit />
                                                                </IconButton>
                                                                <span>Edit</span>
                                                            </MenuItemCustom>
                                                        }
                                                        <MenuItemCustom onClick={() => { this.setState({ menuItemClicked: randomNumberBtwn() }); this.events.deleteCustomer(); }}>
                                                            <IconButton className="delete-cstr" title="Delete Customer">
                                                                <DeleteRoundedIcon />
                                                            </IconButton>
                                                            <span>Delete</span>
                                                        </MenuItemCustom>
                                                    </MoreBtn>
                                                }
                                            </div>

                                        </div>

                                        <div className="profile-bottom-wrap d-flex flex-column flex-grow-1">
                                            <div className="profile-middle-section scroll scroll-y flex-grow-1 p-3">
                                                <ul className="cs-actions-list mt-3 d-flex d-md-inline-block">
                                                    <li className="pr-md-3 pb-md-3">
                                                        <ColorButton variant="outlined" className="cs-actions-btn">
                                                            <span className="icon icon-mail d-flex align-items-center justify-content-center"></span>
                                                            <p>Email</p>
                                                        </ColorButton>
                                                    </li>
                                                    <li className="pr-md-3 pb-md-3">
                                                        <ColorButton variant="outlined" className="cs-actions-btn">
                                                            <span className="icon icon-calendar d-flex align-items-center justify-content-center"></span>
                                                            <p>Meeting</p>
                                                        </ColorButton>
                                                    </li>
                                                    <li className="pr-md-0 pb-md-3">
                                                        <ColorButton variant="outlined" className="cs-actions-btn">
                                                            <span className="icon icon-note d-flex align-items-center justify-content-center"></span>
                                                            <p>Note</p>
                                                        </ColorButton>
                                                    </li>
                                                    <li className="pr-md-3 pb-md-3">
                                                        <ColorButton variant="outlined" className="cs-actions-btn">
                                                            <span className="icon icon-call d-flex align-items-center justify-content-center"></span>
                                                            <p>Call</p>
                                                        </ColorButton>
                                                    </li>
                                                    <li className="pr-md-3 pb-md-3">
                                                        <ColorButton variant="outlined" className="cs-actions-btn">
                                                            <span className="icon icon-task d-flex align-items-center justify-content-center"></span>
                                                            <p>Task</p>
                                                        </ColorButton>
                                                    </li>
                                                    <li className="pb-md-3">
                                                        <ColorButton variant="outlined" className="cs-actions-btn">
                                                            <span className="icon icon-referal d-flex align-items-center justify-content-center"></span>
                                                            <p>Referral</p>
                                                        </ColorButton>
                                                    </li>
                                                </ul>



                                            </div>


                                            <div className="profile-bottom-section px-3">
                                                <div className="relationshit-head d-flex justify-content-between mb-2">
                                                    <h6 className="mb-0">Relationships</h6>
                                                    <div className="d-flex align-items-center add-relation">
                                                        <span className="rounded-circle plus-btn d-flex justify-content-center align-items-center mr-2">
                                                            <FontAwesomeIcon icon="plus" />
                                                        </span>
                                                        <span className="add-relation-btn-txt cursor-pointer"><strong>Add New</strong></span>
                                                    </div>
                                                </div>
                                                <hr />

                                                <ul className="d-flex p-0 justify-content-center relation-list scroll scroll-y">
                                                    <li className="px-2">
                                                        <div className="user-pic medium mx-auto">
                                                            <img alt="altValue" className="img-profile rounded-circle" src={avatar} />
                                                            <div className="relation-type">
                                                                <span className="icon icon-co-worker"></span>
                                                            </div>
                                                        </div>
                                                        <h6>Dave Z</h6>
                                                    </li>
                                                    <li className="px-2">
                                                        <div className="user-pic medium mx-auto">
                                                            <img alt="altValue" className="img-profile rounded-circle" src={avatar} />
                                                            <div className="relation-type">
                                                                <span className="icon icon-realtor"></span>
                                                            </div>
                                                        </div>
                                                        <h6>Keira B</h6>
                                                    </li>
                                                    <li className="px-2">
                                                        <div className="user-pic medium mx-auto">
                                                            <img alt="altValue" className="img-profile rounded-circle" src={avatar} />
                                                            <div className="relation-type">
                                                                <span className="icon icon-realtor"></span>
                                                            </div>
                                                        </div>
                                                        <h6>Dave Z</h6>
                                                    </li>
                                                    <li className="px-2">
                                                        <div className="user-pic medium mx-auto">
                                                            <img alt="altValue" className="img-profile rounded-circle" src={avatar} />
                                                            <div className="relation-type">
                                                                <span className="icon icon-co-worker"></span>
                                                            </div>
                                                        </div>
                                                        <h6>Keira B</h6>
                                                    </li>
                                                </ul>

                                            </div>

                                            <div className={"profile-edit-pop d-flex flex-column px-3 py-3 " + this.state.editCustomerViewClass}>
                                                <div className="profile-edit-head pb-3 d-flex justify-content-between align-items-center mb-2">
                                                    <h5 className="font-weight-bold mb-0">Edit Details</h5>
                                                    <IconButton title="Close" onClick={() => { this.events.toggleEditCustomer('') }}>
                                                        <Close />
                                                    </IconButton>

                                                </div>

                                                <div className="form-wrap flex-grow-1 scroll scroll-y mt-3">
                                                    <div className="form-group">
                                                        <label className="mb-1">First Name</label>
                                                        <EditableSpan name="fname" classnameslist="inline-editable"
                                                            key={this.state.sectionKey['fname']}
                                                            value={this.state.customerDetail.fname}
                                                            onChange={this.events.onUpdateField} />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="mb-1">Last Name</label>
                                                        <EditableSpan name="lname" classnameslist="inline-editable"
                                                            key={this.state.sectionKey['lname']}
                                                            value={this.state.customerDetail.lname}
                                                            onChange={this.events.onUpdateField} />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="mb-1">Email</label>
                                                        <EditableSpan name="email" classnameslist="inline-editable"
                                                            key={this.state.sectionKey['email']}
                                                            value={this.state.customerDetail.email}
                                                            onChange={this.events.onUpdateField} />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="mb-1">Phone Number</label>
                                                        <EditableSpan name="phone" classnameslist="inline-editable"
                                                            key={this.state.sectionKey['phone']}
                                                            value={this.state.customerDetail.phone}
                                                            onChange={this.events.onUpdateField} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>


                                    </div>
                                </div>
                            </div>
                            <div className="bg-customer-profile cs-center-panel m-md-4 m-3 flex-md-grow-1">
                                <div className="d-flex justify-content-between mb-3 align-items-center">
                                    <h5 className="font-weight-extra-bold mb-0">Customer Profile</h5>

                                    <button className="btn btn-secondary d-md-none d-block" onClick={() => this.events.activityDrawerToggle('open-drawer')}>Activity ({this.state.customerDetail.acti.filter((obj) => { return obj.title; }).length})</button>
                                </div>
                                <div className="bg-white box-shadow px-4 py-4 center-panel-block">
                                    <div className="row align-items-center">
                                        <div className="col-md-12 col-lg-6" key={this.state.sectionKey['stage']}>
                                            <div className="form-group row align-items-center">
                                                <label htmlFor="stage" className="col-sm-4 font-weight-bold">Stage</label>
                                                <div className="col-sm-8">
                                                    <SelectBox
                                                        id="stage"
                                                        currentValue={this.state.customerDetail.stage}
                                                        updateAction={this.events.updateFormAction}
                                                        list={this.state.stageList}>
                                                    </SelectBox>
                                                </div>
                                            </div>

                                        </div>
                                        <div className="col-md-12 col-lg-6">
                                            <div className="form-group row align-items-center">
                                                <label htmlFor="source" className="col-sm-4 font-weight-bold">Source:</label>
                                                <div className="col-sm-8">
                                                    <span id="source">{this.state.customerDetail.psrc}</span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                    <div className="row align-items-center">
                                        <div className="col-md-12 col-lg-6" key={this.state.sectionKey['inte']}>
                                            <div className="form-group row">
                                                <label htmlFor="interest" className="col-sm-4 font-weight-bold">Interest:</label>
                                                <div className="col-sm-8">
                                                    <PopOverMUI
                                                        id="interestPopOverId"
                                                        htmlTag="checkbox"
                                                        checkedItems={checkedInterests}
                                                        emptyText="Add Interest"
                                                        joinProperty="name"
                                                        childrenWrapClass="px-3 py-3"
                                                    >
                                                        <CheckboxList
                                                            id="inte"
                                                            keyValue="inte"
                                                            updateAction={this.events.updateFormAction}
                                                            list={this.state.propertyLists}
                                                            enableNative={false} />
                                                    </PopOverMUI>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-md-12 col-lg-6" key={this.state.sectionKey['infl']}>
                                            <div className="form-group row">
                                                <label htmlFor="influence" className="col-sm-4 font-weight-bold">Influence:</label>
                                                <div className="col-sm-8">
                                                    <PopOverMUI
                                                        id="influencePopOverId"
                                                        htmlTag="checkbox"
                                                        checkedItems={checkedInfluences}
                                                        emptyText="Add Influence"
                                                        joinProperty="name"
                                                        childrenWrapClass="px-3 py-3"
                                                    >
                                                        <CheckboxList id="infl" keyValue="infl"
                                                            updateAction={this.events.updateFormAction}
                                                            list={this.state.influenceList}
                                                            enableNative={false} />
                                                    </PopOverMUI>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="row align-items-center" key={this.state.sectionKey['rltr']}>
                                        <div className="col-lg-6 col-md-12">
                                            <div className="form-group row">
                                                <label htmlFor="realtor" className="col-sm-4 font-weight-bold">Realtor:</label>
                                                <div className="col-sm-8">
                                                    <PopOverMUI
                                                        id="realtorPopOverId"
                                                        checkedItems={this.state.customerDetail.rltr}
                                                        htmlTag="select"
                                                        emptyText="Add Realtor"
                                                        joinProperty="name"
                                                        childrenWrapClass="px-3 py-3"
                                                    >
                                                        <RadioBox
                                                            id="rltr"
                                                            currentValue={this.state.customerDetail.rltr}
                                                            updateAction={this.events.updateFormAction}
                                                            list={this.state.realtorList}
                                                            enableNative={false}
                                                            row={false}
                                                        />
                                                    </PopOverMUI>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="col-lg-6 col-md-12">
                                            <div className="form-group row align-items-center" key={this.state.sectionKey['grade']}>
                                                <label htmlFor="grade" className="col-sm-4 font-weight-bold mb-lg-0">Grade:</label>
                                                <div className="col-sm-8">
                                                    <SelectBox
                                                        id="grade"
                                                        currentValue={this.state.customerDetail.grade}
                                                        updateAction={this.events.updateFormAction}
                                                        list={this.state.gradeList} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="row align-items-center">
                                        <div className="col-md-12 col-lg-6" key={this.state.sectionKey['cntm']}>
                                            <div className="form-group row align-items-center">
                                                <label htmlFor="cntm" className="col-sm-4 font-weight-bold mb-lg-0">Contact Method:</label>
                                                <div className="col-sm-8">
                                                    <SelectBox
                                                        id="cntm"
                                                        currentValue={this.state.customerDetail.cntm}
                                                        updateAction={this.events.updateFormAction}
                                                        list={this.state.contactMethodList} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <hr className="block-divider large" />
                                    <div className="row" key={this.state.sectionKey['desf']}>
                                        <div className="col-md-12">
                                            <label htmlFor="desf" className="font-weight-bold mb-1">Desired Features</label>
                                            <CheckboxList
                                                id="desf"
                                                keyValue="desf"
                                                updateAction={this.events.updateFormAction}
                                                list={this.state.desiredFeaturesLists}
                                                enableNative={true} />
                                        </div>
                                    </div>
                                    <hr className="block-divider large" />
                                    <div className="row" key={this.state.sectionKey['desm']}>
                                        <div className="col-md-12">
                                            <label htmlFor="desm" className="font-weight-bold mb-1">How soon do you want to move?</label>
                                            <RadioBox
                                                id="desm"
                                                currentValue={this.state.customerDetail.desm}
                                                updateAction={this.events.updateFormAction}
                                                list={this.state.desiredMoveList}
                                                enableNative={true}
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>
                            {!this.state.mobileView &&
                                <Box px="0" height="100%" className={"cs-right-panel " + this.state.activityClass + ' ' + this.state.activityDrawerClass}>
                                    {timeLineTemplate}
                                </Box>
                            }
                            {
                                this.state.mobileView &&
                                <DrawerMUI>
                                    {timeLineTemplate}
                                </DrawerMUI>
                            }
                        </div>
                    </div>
                }
                {this.state.openUpdateCustomerConfirmationDialog && <ConfirmationDialog key={this.state.confirmKey} id="update-customer-confirm-id"
                    title="Confirm Save Changes" message="Do you want to update the customer details?" action="customer_update"
                    onOk={this.events.confirmationOk}
                    onCancel={this.events.confirmationCancel} />}
                {this.state.openDeleteCustomerConfirmationDialog && <ConfirmationDialog key={this.state.deleteConfirmKey} id="delete-customer-confirm-id"
                    title="Confirm Delete" message="Do you want to delete the customer?" action="customer_delete"
                    onOk={this.events.confirmationOk}
                    onCancel={this.events.confirmationCancel} />}
            </>
        );
    }
}

export default CustomerDetail;
