import React from 'react';
import { fade, makeStyles, withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import IconButton from '@material-ui/core/IconButton';
import InputBase from '@material-ui/core/InputBase';
import Badge from '@material-ui/core/Badge';
import MenuItem from '@material-ui/core/MenuItem';
import Menu from '@material-ui/core/Menu';
import SearchIcon from '@material-ui/icons/Search';
import AccountCircle from '@material-ui/icons/AccountCircle';
import MailIcon from '@material-ui/icons/Mail';
import MenuIcon from '@material-ui/icons/Menu';
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Box from '@material-ui/core/Box';
import Search from '@material-ui/icons/Search';
import Settings from '@material-ui/icons/Settings';
import NotificationsActive from '@material-ui/icons/NotificationsActive';
import Avatar from '@material-ui/core/Avatar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

import mainLogo from '../../Assets/images/logo.png';
import avatar from '../../Assets/images/avatar.png';

const AppBarCustom = withStyles(theme => ({
    root: {
        display: 'flex',
        backgroundColor: '#fff'
    },
}))(AppBar);

const IconButtonCustom = withStyles(theme => ({
    root: {
        color: '#353535',
        fontSize: '1rem',
        borderRadius: 0,
        fontWeight: theme.typography.fontWeightBold,
        backgroundColor: 'transparent',
        '&:hover': {
            backgroundColor: 'transparent'
        },
    },
}))(IconButton);

const ToolbarCustom = withStyles(theme => ({
    root: {
        display: 'flex'
    },
}))(Toolbar);

const useStyles = makeStyles(theme => ({
    grow: {
        flexGrow: 1,
    },
    menuButton: {
        marginRight: theme.spacing(2),
    },
    title: {
        display: 'none',
        [theme.breakpoints.up('sm')]: {
            display: 'block',
        },
    },
    tabs: {
        display: 'none',
        [theme.breakpoints.up('sm')]: {
            display: 'block',
        },
    },
    search: {
        position: 'relative',
        borderRadius: theme.shape.borderRadius,
        backgroundColor: fade(theme.palette.common.white, 0.15),
        '&:hover': {
            backgroundColor: fade(theme.palette.common.white, 0.25),
        },
        marginRight: theme.spacing(2),
        marginLeft: 0,
        width: '100%',
        [theme.breakpoints.up('sm')]: {
            marginLeft: theme.spacing(3),
            width: 'auto',
        },
    },
    logo: {
        width: '100%',
        height: '50px',
        [theme.breakpoints.up('sm')]: {
            width: 'auto'
        },
    },
    searchIcon: {
        width: theme.spacing(7),
        height: '100%',
        position: 'absolute',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputRoot: {
        color: 'inherit',
    },
    inputInput: {
        padding: theme.spacing(1, 1, 1, 7),
        transition: theme.transitions.create('width'),
        width: '100%',
        [theme.breakpoints.up('md')]: {
            width: 200,
        },
    },
    sectionDesktop: {
        display: 'none',
        [theme.breakpoints.up('md')]: {
            display: 'flex',
        }
    },
    sectionMobile: {
        display: 'flex',
        [theme.breakpoints.up('md')]: {
            display: 'none',
        },
    },
}));

const StyledTabs = withStyles({
    root: {
        minHeight: '64px'
    },
    indicator: {
        display: "flex",
        justifyContent: "center",
        backgroundColor: "transparent",
        "& > div": {
            width: "100%",
            backgroundColor: "#F37620"
        }
    }
})(props => (
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


export default function Navbar(props) {
    const classes = useStyles();
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = React.useState(null);

    const isMenuOpen = Boolean(anchorEl);
    const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);

    const [value, setValue] = React.useState(0);

    function handleChange(event, newValue) {
        setValue(newValue);
    }


    function handleProfileMenuOpen(event) {
        setAnchorEl(event.currentTarget);
    }

    function handleMobileMenuClose() {
        setMobileMoreAnchorEl(null);
    }

    function handleMenuClose() {
        setAnchorEl(null);
        handleMobileMenuClose();
    }

    function handleMobileMenuOpen(event) {
        setMobileMoreAnchorEl(event.currentTarget);
    }

    const menuId = 'primary-search-account-menu';
    const renderMenu = (
        <>
            <Menu
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                id={menuId}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={isMenuOpen}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
                <MenuItem onClick={handleMenuClose}>My account</MenuItem>
            </Menu>
        </>
    );

    const mobileMenuId = 'primary-search-account-menu-mobile';
    const renderMobileMenu = (
        <>
            <Menu
                anchorEl={mobileMoreAnchorEl}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                id={mobileMenuId}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={isMobileMenuOpen}
                onClose={handleMobileMenuClose}
            >
                <MenuItem><p>Customers</p></MenuItem>
                <MenuItem><p>Realtors &reg;</p></MenuItem>
                <MenuItem><p>Campaigns</p></MenuItem>
                <MenuItem>
                    <IconButton aria-label="Show 4 new mails" color="inherit">
                        <Badge badgeContent={4} color="secondary">
                            <MailIcon />
                        </Badge>
                    </IconButton>
                    <p>Messages</p>
                </MenuItem>
                <MenuItem>
                    <IconButton aria-label="Show 11 new notifications" color="inherit">
                        <Badge badgeContent={11} color="secondary">
                            <NotificationsActive />
                        </Badge>
                    </IconButton>
                    <p>Notifications</p>
                </MenuItem>
                <MenuItem onClick={handleProfileMenuOpen}>
                    <IconButton
                        aria-label="Account of current user"
                        aria-controls="primary-search-account-menu"
                        aria-haspopup="true"
                        color="inherit"
                    >
                        <AccountCircle />
                    </IconButton>
                    <p>Profile</p>
                </MenuItem>
            </Menu>
        </>
    );

    return (
        <div className={classes.grow}>
            <AppBarCustom position="static" color="default">
                <ToolbarCustom>
                    <Box className={classes.logo}>
                        <img alt="altValue" className="img-fluid" src={mainLogo} />
                    </Box>
                    <Box mx="auto" display="flex" className={classes.tabs}>
                        <StyledTabs value={value} onChange={handleChange}
                            className="page-nav navbar-nav mx-auto h-md-100  justify-content-center justify-md-content-flex-start">
                            <StyledTab label="Customers" />
                            <StyledTab label="Realtors &reg;" />
                            <StyledTab label="Campaigns" />
                        </StyledTabs>
                    </Box>
                    {/* <div className={classes.search}>
                        <div className={classes.searchIcon}>
                            <SearchIcon />
                        </div>
                        <InputBase
                            placeholder="Search…"
                            classes={{
                                root: classes.inputRoot,
                                input: classes.inputInput,
                            }}
                            inputProps={{ 'aria-label': 'Search' }}
                        />
                    </div> */}
                    {/* <div className={classes.grow} /> */}
                    <div className={classes.sectionDesktop}>
                        <IconButton>
                            <Search />
                        </IconButton>
                        <IconButton>
                            <Settings />
                        </IconButton>
                        <IconButton aria-label="Show 17 new notifications">
                            <Badge badgeContent={17} color="secondary" variant="dot">
                                <NotificationsActive />
                            </Badge>
                        </IconButton>
                        <IconButton
                            edge="end"
                            aria-label="Account of current user"
                            aria-controls={menuId}
                            aria-haspopup="true"
                            onClick={handleProfileMenuOpen}
                        >
                            <Avatar alt="Remy Sharp" src={avatar} className={classes.avatar} />
                        </IconButton>
                        <IconButtonCustom edge="end" aria-label="Account of current user"
                            aria-controls={menuId}
                            aria-haspopup="true" onClick={handleProfileMenuOpen}>{props.userDetails.fname} {props.userDetails.lname}</IconButtonCustom>
                    </div>
                    <div className={classes.sectionMobile}>
                        <IconButton
                            aria-label="Show more"
                            aria-controls={mobileMenuId}
                            aria-haspopup="true"
                            onClick={handleMobileMenuOpen}
                        >
                            <MenuIcon />
                        </IconButton>
                    </div>
                </ToolbarCustom>
            </AppBarCustom>
            {renderMobileMenu}
            {renderMenu}
        </div>
    );
}
