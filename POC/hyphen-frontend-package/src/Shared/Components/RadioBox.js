import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Radio from "@material-ui/core/Radio";
import RadioGroup from "@material-ui/core/RadioGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import FormControl from "@material-ui/core/FormControl";
import FormLabel from "@material-ui/core/FormLabel";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import _ from "lodash";

const useStyles = makeStyles(theme => ({
    root: {
        display: "flex"
    },
    formControl: {
    },
    group: {
    }
}));

export default function RadioBox(props) {
    const classes = useStyles();
    const [state, setState] = React.useState({
        list: _.cloneDeep(props.list),
        currentValue: _.cloneDeep(props.currentValue)
    });

    function handlePropertyChange(event) {
        event.persist();
        if (event.target && event.target.value) {
            setState(oldValues => ({
                ...oldValues,
                currentValue: event.target.value,
            }));
            props.updateAction(event.target.value, props.id);
        }
    }

    const { list, currentValue } = state;

    return (
        <>
            {props.enableNative ?
                (list.length > 0 &&
                    <ul className="custom-buttons p-0 m-0" >
                        {list.map((radioBoxitem, i) => {
                            return (
                                <li className="custom-btn-label font-weight-bold" key={i}>
                                    <input id={props.id + '_' + i} type="radio"
                                        name={props.id}
                                        value={radioBoxitem}
                                        checked={currentValue === radioBoxitem}
                                        onChange={handlePropertyChange}
                                    />
                                    <label htmlFor={props.id + '_' + i}>
                                        <span className="check-ico mr-2">
                                            <FontAwesomeIcon icon="check" />
                                        </span>
                                        {radioBoxitem}</label>
                                </li>
                            );
                        })}
                    </ul>) :
                (list.length > 0 &&
                    <div className={classes.root}>
                        <FormControl component="fieldset" className={classes.formControl}>
                            {props.label && <FormLabel component="legend" htmlFor={props.id}>{props.label}</FormLabel>}
                            <RadioGroup
                                row={props.row}
                                aria-label={props.id}
                                className={classes.group}
                                value={currentValue ? currentValue : ''}
                                onChange={handlePropertyChange}
                            >
                                {list.length > 0 && list.map((radioBoxitem, i) => {
                                    return (
                                        <FormControlLabel key={i} value={radioBoxitem} control={<Radio />} label={radioBoxitem} />
                                    );
                                })}
                            </RadioGroup>
                        </FormControl>
                    </div>)
            }
        </>
    );
}
