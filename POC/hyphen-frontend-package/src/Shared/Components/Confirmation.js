import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Dialog from '@material-ui/core/Dialog';

const ButtonCustom = withStyles(theme => ({
    root: {
        fontWeight: theme.typography.fontWeightBold
    },
}))(Button);

const DialogTitleCustom = withStyles(theme => ({
    root: {
        padding: '12px 24px',
        '& h6': {
            fontWeight: theme.typography.fontWeightBold
        }
    }
}))(DialogTitle);

const DialogContentCustom = withStyles(theme => ({
    root: {
        padding: '0px 24px'
    }
}))(DialogContent);

function ConfirmationDialogRaw(props) {
    const { onOk, onCancel, open, ...other } = props;

    function handleCancel() {
        onCancel();
    }

    function handleOk() {
        onOk();
    }

    return (
        <Dialog
            disableBackdropClick
            disableEscapeKeyDown
            maxWidth="xs"
            aria-labelledby="confirmation-dialog-title"
            open={open}
            {...other}
        >
            <DialogTitleCustom id="confirmation-dialog-title">{props.title}</DialogTitleCustom>
            <DialogContentCustom>
                {props.message}
            </DialogContentCustom>
            <DialogActions>
                <ButtonCustom onClick={handleCancel} color="primary">
                    Cancel
        </ButtonCustom>
                <ButtonCustom onClick={handleOk} color="primary">
                    Ok
        </ButtonCustom>
            </DialogActions>
        </Dialog>
    );
}

ConfirmationDialogRaw.propTypes = {
    onOk: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    open: PropTypes.bool.isRequired
};

const useStyles = makeStyles(theme => ({
    root: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: theme.palette.background.paper
    },
    paper: {
        width: '80%',
        maxWidth: 320,
        maxHeight: 435,
    },
}));

export default function ConfirmationDialog(props) {
    const classes = useStyles();
    const [open, setOpen] = React.useState(true);

    function onOk(val) {
        props.onOk(props.action);
        setOpen(false);
    }

    function onCancel(val) {
        props.onCancel(props.action);
        setOpen(false);
    }

    return (
        <>
            <ConfirmationDialogRaw
                classes={{
                    paper: classes.paper,
                }}
                id={props.id}
                title={props.title}
                message={props.message}
                keepMounted
                open={open}
                onOk={onOk}
                onCancel={onCancel}
            />
        </>
    );
}
