import React, { useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import InputBase from '@material-ui/core/InputBase';
import IconButton from '@material-ui/core/IconButton';
import SearchIcon from '@material-ui/icons/Search';
import Close from '@material-ui/icons/Close';
import Chip from '@material-ui/core/Chip';
import { ManageLocalStorage } from "../../Services/LocalStorage";

const useStyles = makeStyles({
  root: {
    padding: '2px 4px',
    display: 'flex',
    alignItems: 'center',
    height: '2.8rem'
  },
  input: {
    marginLeft: 8,
    flex: 1,
  },
  iconButton: {
    padding: 10,
  }
});

export default function SearchBtn(props) {
  const classes = useStyles();

  const [state, setState] = React.useState({
    searchKey: ''
  });

  function handlePropertyChange(event) {
    event.persist();
    if (event && event.target && event.target.value !== undefined && event.target.value !== null) {
      setState(oldValues => ({
        ...oldValues,
        searchKey: event.target.value,
      }));
    }
  }

  function invokeSearch() {
    props.onChangeSearchAction(searchKey);
  }

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      invokeSearch();
    }
  }

  function clearSearch() {
    setState(oldValues => ({
      ...oldValues,
      searchKey: '',
    }));
    props.onChangeSearchAction('');
  }

  const { searchKey } = state;

  /*eslint-disable */
  useEffect(() => {
    if (props.storageKey && props.storageKey.length > 0 && ManageLocalStorage.get(props.storageKey)) {
      setState(oldValues => ({
        ...oldValues,
        searchKey: ManageLocalStorage.get(props.storageKey),
      }));
      props.onChangeSearchAction(ManageLocalStorage.get(props.storageKey));
    }
  }, []); // passing an empty array as second argument triggers the callback in useEffect only after the initial render thus replicating `componentDidMount` lifecycle behaviour
  /*eslint-enable */

  return (
    <Paper className={classes.root}>
      <InputBase
        className={classes.input}
        placeholder={props.placeHolder}
        inputProps={{ 'aria-label': 'Search' }}
        value={searchKey}
        onChange={handlePropertyChange}
        onKeyPress={handleKeyPress}
      />
      <IconButton className={classes.iconButton} aria-label="Search" onClick={(searchKey.length && props.resultLength === 0 && props.alternateListLength === 0) ? clearSearch : invokeSearch}>
        {(searchKey.length && props.resultLength === 0 && props.alternateListLength === 0) ? <Close /> : <SearchIcon />}
      </IconButton>
      {(searchKey.length && props.resultLength > 0) ? <Chip label={searchKey} onDelete={clearSearch} /> : ''}
    </Paper>
  );
}
