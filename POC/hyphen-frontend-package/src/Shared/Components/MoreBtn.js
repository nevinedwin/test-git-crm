import React from "react";
import IconButton from "@material-ui/core/IconButton";
import Menu from "@material-ui/core/Menu";
import MoreIcon from "@material-ui/icons/MoreVert";
import { withStyles } from '@material-ui/core/styles';

const IconButtonCustom = withStyles(theme => ({
  root: {
    color: '#fff'
  },
}))(IconButton);

const MenuCustom = withStyles(theme => ({
  paper: {
    boxShadow: '0px 2px 3px rgba(0,0,0,0.2)'
  },
}))(Menu);

export default function MoreBtn(props) {
  const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = React.useState(null);

  const isMobileMenuOpen = Boolean(mobileMoreAnchorEl);

  function handleMobileMenuClose() {
    setMobileMoreAnchorEl(null);
  }

  function handleMobileMenuOpen(event) {
    setMobileMoreAnchorEl(event.currentTarget);
  }

  // function setStageClass() {
  //   switch (props.bgColor) {
  //     case 'theme-lead':
  //       break;
  //     case 'theme-prospect':
  //       break;
  //     case 'theme-buyer':
  //       break;
  //     case 'theme-bustout':
  //       break;
  //     case 'theme-closed':
  //       break;
  //     case 'theme-deadlead':
  //       break;
  //     default:
  //       break;
  //   }
  // }

  const mobileMenuId = "primary-search-account-menu-mobile";
  const renderMobileMenu = (
    <MenuCustom
      anchorEl={mobileMoreAnchorEl}
      id={mobileMenuId}
      keepMounted
      open={isMobileMenuOpen}
      onClose={handleMobileMenuClose}
      elevation={0}
      getContentAnchorEl={null}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
    >
      {props.children}
    </MenuCustom>
  );

  return (
    <>
      <IconButtonCustom
        aria-label="Show more"
        aria-controls={mobileMenuId}
        aria-haspopup="true"
        onClick={handleMobileMenuOpen}
        color="inherit"
      >
        <MoreIcon />
      </IconButtonCustom>
      {renderMobileMenu}
    </>
  );
}
