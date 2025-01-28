import React from 'react';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import FormLabel from "@material-ui/core/FormLabel";
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import Select from '@material-ui/core/Select';
import _ from "lodash";
import InputBase from '@material-ui/core/InputBase';

const BootstrapInput = withStyles(theme => ({
    root: {
        textTransform: 'capitalize',
        'label + &': {
            marginTop: theme.spacing(3),
        },
    },
    input: {
        borderRadius: 4,
        position: 'relative',
        backgroundColor: '#f9f9f9',
        border: '1px solid #dddddd',
        fontSize: 14,
        padding: '12px 26px 12px 12px',
        transition: theme.transitions.create(['border-color', 'box-shadow']),
        '&:focus': {
            borderRadius: 4,
            borderColor: '#80bdff',
            boxShadow: '0 0 0 0.2rem rgba(0,123,255,.25)',
        },
    },
}))(InputBase);

const MenuItemCustom = withStyles(theme => ({
    root: {
        textTransform: 'capitalize'
    }
}))(MenuItem);

const useStyles = makeStyles(theme => ({
    root: {
        display: 'flex'
    },
    formControl: {
        width: '100%',

    },
    selectEmpty: {
    },
}));

export default function SelectBox(props) {
    const classes = useStyles();
    const [state, setState] = React.useState({
        list: _.cloneDeep(props.list),
        currentValue: _.cloneDeep(props.currentValue)
    });

    function handlePropertyChange(event) {
        setState(oldValues => ({
            ...oldValues,
            currentValue: event.target.value,
        }));
        props.updateAction(event.target.value, event.target.name);
    }

    const { list, currentValue } = state;

    return (
        list.length > 0 &&
        <div className={classes.root}>
            <FormGroup component="fieldset" className={classes.formControl}>
                {props.label && <FormLabel component="legend" htmlFor={props.id}>{props.label}</FormLabel>}
                <FormControl>
                    <Select
                        IconComponent={() => (
                            <span className="icon icon-arrow-right MuiSvgIcon-root MuiSelect-icon"></span>
                        )}
                        value={currentValue ? currentValue : ''}
                        onChange={handlePropertyChange}
                        inputProps={{
                            name: props.id,
                            id: props.id,
                        }}
                        input={<BootstrapInput name="age" id="age-customized-select" />}
                    >
                        {list.length > 0 && list.map((propertyItem, i) => {
                            return (
                                <MenuItemCustom key={i} value={propertyItem}>{propertyItem}</MenuItemCustom>
                            );
                        })}
                    </Select>
                </FormControl>
            </FormGroup>
        </div>
    );
}
