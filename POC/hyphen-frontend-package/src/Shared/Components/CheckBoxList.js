import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import Checkbox from '@material-ui/core/Checkbox';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import _ from "lodash";

const useStyles = makeStyles(theme => ({
    root: {
        display: 'flex',
    },
    formControl: {
    },
}));

export default function CheckboxList(props) {
    const classes = useStyles();
    const [state, setState] = React.useState({
        list: _.cloneDeep(props.list)
    });

    const handlePropertyChange = name => event => {
        let listTemp = _.cloneDeep(list);
        let objIndex = listTemp.findIndex((obj => obj.id === name.id));
        listTemp[objIndex].checked = event.target.checked;
        props.updateAction(listTemp, props.keyValue);
        setState({ ...state, list: listTemp });
    };

    const { list } = state;

    return (
        <>
            {props.enableNative ?
                (list.length > 0 &&
                    <ul className="p-0 custom-buttons d-flex flex-row flex-wrap checkbox m-0">
                        {list.length > 0 && list.map((checkBoxitem, i) => {
                            return (
                                <li className="custom-btn-label" key={i}>
                                    <input type="checkbox" id={props.id + '_' + checkBoxitem.id}
                                        value={checkBoxitem.name}
                                        onChange={handlePropertyChange(checkBoxitem)}
                                        checked={checkBoxitem.checked} />
                                    <label htmlFor={props.id + '_' + checkBoxitem.id} className="flex-shrink-0 align-items-center font-weight-bold">
                                        <span className="check-ico d-flex align-items-center justify-content-center m-1">
                                            {
                                                checkBoxitem.checked ? <FontAwesomeIcon icon="check" /> : <FontAwesomeIcon icon="plus" />
                                            }
                                        </span>
                                        {checkBoxitem.name}
                                    </label>
                                </li>
                            );
                        })}
                    </ul>) :
                (list.length > 0 &&
                    <div className={classes.root}>
                        <FormControl component="fieldset" className={classes.formControl}>
                            {props.label && <FormLabel component="legend" htmlFor={props.id}>{props.label}</FormLabel>}
                            <FormGroup id={props.id} row={props.row}>
                                {list.length > 0 && list.map((checkBoxitem, i) => {
                                    return (
                                        <FormControlLabel key={i}
                                            control={<Checkbox checked={checkBoxitem.checked} onChange={handlePropertyChange(checkBoxitem)} value={checkBoxitem.name} />}
                                            label={checkBoxitem.name}
                                        />
                                    );
                                })}
                            </FormGroup>
                        </FormControl>
                    </div>)
            }
        </>
    );
}
