import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import SpeedDial from '@material-ui/lab/SpeedDial';
import SpeedDialIcon from '@material-ui/lab/SpeedDialIcon';
import SpeedDialAction from '@material-ui/lab/SpeedDialAction';
import PersonAdd from '@material-ui/icons/PersonAdd';

const styles = theme => ({
    speedDial: {
        position: 'absolute',
        bottom: theme.spacing(2),
        right: theme.spacing(3),
    },
});

const actions = [
    { icon: <PersonAdd />, name: 'Add Customer' },
];

const customerAddActions = [
    { icon: <PersonAdd />, name: 'Add Customer' },
    { icon: <span className="icon icon-mail d-flex align-items-center justify-content-center"></span>, name: 'Email' },
    { icon: <span className="icon icon-calendar d-flex align-items-center justify-content-center"></span>, name: 'Meeting' },
    { icon: <span className="icon icon-note d-flex align-items-center justify-content-center"></span>, name: 'Note' },
    { icon: <span className="icon icon-call d-flex align-items-center justify-content-center"></span>, name: 'Call' },
    { icon: <span className="icon icon-task d-flex align-items-center justify-content-center"></span>, name: 'Task' },
    { icon: <span className="icon icon-referal d-flex align-items-center justify-content-center"></span>, name: 'Referral' },
];

class SpeedDialTooltipOpen extends React.Component {
    _isMounted = false;
    state = {
        open: false,
        hidden: false,
        mobileView: ''
    };

    handleVisibility = () => {
        if (this._isMounted) {
            this.setState(state => ({
                open: false,
                hidden: !state.hidden,
            }));
        }
    };

    handleClick = (events) => {
        if (this._isMounted) {
            this.setState(state => ({
                open: !state.open,
            }));
        }
    };

    handleDialClick = name => event => {
        if (name === 'Add Customer') {
            this.props.customerNew();
        }
    };

    handleOpen = () => {
        if (this._isMounted) {
            if (!this.state.hidden) {
                this.setState({
                    open: true,
                });
            }
        }
    };

    getCurrentActions = () => {
        switch (this.props.data.currentComponent) {
            case 'customer_detail':
                if (this.state.mobileView) {
                    return customerAddActions;
                } else {
                    return actions;
                }
            default:
                return actions;
        }
    }

    handleClose = () => {
        if (this._isMounted) {
            this.setState({
                open: false,
            });
        }
    }

    resize() {
        if (this._isMounted) {
            if (window.innerWidth <= 767) {
                this.setState({ mobileView: true });
            } else {
                this.setState({ mobileView: false });
            }
        }
    }

    componentDidMount() {
        this._isMounted = true;
        window.addEventListener("resize", this.resize.bind(this));
        this.resize();
    }

    componentWillUnmount() {
        this._isMounted = false;
    }

    render() {
        const { classes } = this.props;
        const { hidden, open } = this.state;

        // onBlur={this.state.mobileView ? this.handleClose : () => { }}
        // onFocus={this.state.mobileView ? this.handleOpen : () => { }}
        // onMouseEnter={this.state.mobileView ? this.handleOpen : () => { }}
        // onMouseLeave={this.state.mobileView ? this.handleClose : () => { }}

        return (
            <>
                {
                    <div className={classes.root}>
                        <SpeedDial
                            style={{
                                margin: '0px',
                                top: 'auto',
                                right: '20px',
                                bottom: '20px',
                                left: 'auto',
                                position: 'fixed'
                            }}
                            ariaLabel="SpeedDial tooltip example"
                            className={classes.speedDial}
                            hidden={hidden}
                            icon={<SpeedDialIcon color="secondary" />}
                            onClick={this.handleClick}
                            onClose={this.handleClose}
                            open={open}
                            color="secondary"
                        >
                            {this.getCurrentActions().map(action => (
                                <SpeedDialAction
                                    key={action.name}
                                    icon={action.icon}
                                    tooltipTitle={action.name}
                                    tooltipOpen
                                    onClick={this.handleDialClick(action.name)}
                                    color="secondary"
                                />
                            ))}
                        </SpeedDial>
                    </div>
                }
            </>
        );
    }
}

SpeedDialTooltipOpen.propTypes = {
    classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(SpeedDialTooltipOpen);
