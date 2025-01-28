import React from 'react';
import { withStyles, makeStyles } from '@material-ui/core/styles';
import Drawer from '@material-ui/core/Drawer';

const useStyles = makeStyles({
    list: {
        width: 250,
        height: '100%',
    },
    fullList: {
        width: 'auto',
        height: '100%',
    }
});

const SwipeableDrawerCustom = withStyles(theme => ({
    paperAnchorBottom: {
        height: '80%',
    }
}))(Drawer);

let toggleDrawerMUIFn;

export default function DrawerMUI(props) {
    const classes = useStyles();
    const [state, setState] = React.useState({
        bottom: false,
    });

    const toggleDrawer = (side, open) => event => {
        if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }

        setState({ ...state, [side]: open });
    };

    const toggleDrawerMUI = (toggleVal) => {
        setState({ ...state, bottom: toggleVal });
    };

    toggleDrawerMUIFn = toggleDrawerMUI;

    return (
        <>
            <SwipeableDrawerCustom
                anchor="bottom"
                open={state.bottom}
                onClose={toggleDrawer('bottom', false)}>
                <div
                    className={classes.fullList}
                    role="presentation"
                    onKeyDown={toggleDrawer('bottom', false)}
                >
                    {props.children}
                </div>
            </SwipeableDrawerCustom>
        </>
    );
}

export function toggleDrawerMUI(toggleVal) {
    toggleDrawerMUIFn(toggleVal);
}
