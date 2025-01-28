import React from 'react';
import { makeStyles, withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import { deepOrange, deepPurple, teal, lime, grey } from '@material-ui/core/colors';
import Avatar from '@material-ui/core/Avatar';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Divider from '@material-ui/core/Divider';
import Link from '@material-ui/core/Link';

import { randomNumberBtwn } from '../../Utilities/Utils';
import { history } from '../../Core/Store';

const useStyles = makeStyles(theme => ({
    card: {
        minWidth: '100%',
    },
    title: {
        fontSize: 14,
        color: '#5f6368'
    },
    heading: {
        fontSize: 16,
    },
    orangeAvatar: {
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 10,
        color: '#fff',
        backgroundColor: deepOrange[500],
    },
    purpleAvatar: {
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 10,
        color: '#fff',
        backgroundColor: deepPurple[500],
    },
    tealAvatar: {
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 10,
        color: '#fff',
        backgroundColor: teal[500],
    },
    limeAvatar: {
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 10,
        color: '#fff',
        backgroundColor: lime[500],
    },
    greyAvatar: {
        marginTop: 0,
        marginLeft: 0,
        marginRight: 0,
        marginBottom: 10,
        color: '#fff',
        backgroundColor: grey[500],
    },
    bodyCard: {
        color: '#80868b'
    },
    paper: {
        width: '100%',
        marginTop: '10px'
    }
}));

const LinkCustom = withStyles(theme => ({
    root: {
        color: 'inherit'
    },
}))(Link);

export default function CardsCustom(props) {
    const classes = useStyles();

    const getAvatarByType = (item) => {
        let retVal = '';
        switch (item.type) {
            case 'agent':
                retVal = <Avatar className={classes.orangeAvatar}>A</Avatar>;
                break;
            case 'customer':
                retVal = <Avatar className={classes.purpleAvatar}>C</Avatar>;
                break;
            case 'property':
                retVal = <Avatar className={classes.tealAvatar}>P</Avatar>;
                break;
            case 'builder':
                retVal = <Avatar className={classes.limeAvatar}>B</Avatar>;
                break;
            default:
                retVal = <Avatar className={classes.greyAvatar}></Avatar>;
                break;
        }
        return retVal;
    }

    const getSubTitleByType = (item) => {
        let retVal = '';
        switch (item.type) {
            case 'agent':
                retVal = 'Agent';
                break;
            case 'customer':
                retVal = 'Customer';
                break;
            case 'property':
                retVal = 'Property';
                break;
            case 'builder':
                retVal = 'Builder';
                break;
            default:
                break;
        }
        return retVal;
    }

    const getChangeType = (item) => {
        let retVal = '--';
        switch (item) {
            case 'name':
            case 'fname':
            case 'lname':
                retVal = 'Name';
                break;
            case 'email':
                retVal = 'Email';
                break;
            case 'phone':
                retVal = 'Phone';
                break;
            case 'address':
                retVal = 'Address';
                break;
            case 'stage':
                retVal = 'Stage';
                break;
            case 'psrc':
                retVal = 'Source';
                break;
            case 'cntm':
                retVal = 'Contact Method';
                break;
            case 'grade':
                retVal = 'Grade';
                break;
            case 'inte':
                retVal = 'Interest';
                break;
            case 'infl':
                retVal = 'Influence';
                break;
            case 'rltr':
                retVal = 'Realtor';
                break;
            case 'desf':
                retVal = 'Desired Features';
                break;
            case 'desm':
                retVal = 'When Moving in';
                break;
            case 'acti':
                retVal = 'Activities';
                break;
            default:
                break;
        }
        switch (true) {
            case item.includes('name.'):
            case item.includes('fname.'):
            case item.includes('lname.'):
                retVal = 'Name';
                break;
            case item.includes('email.'):
                retVal = 'Email';
                break;
            case item.includes('phone.'):
                retVal = 'Phone';
                break;
            case item.includes('address.'):
                retVal = 'Address';
                break;
            case item.includes('stage.'):
                retVal = 'Stage';
                break;
            case item.includes('psrc.'):
                retVal = 'Source';
                break;
            case item.includes('cntm.'):
                retVal = 'Contact Method';
                break;
            case item.includes('grade.'):
                retVal = 'Grade';
                break;
            case item.includes('inte.'):
                retVal = 'Interest';
                break;
            case item.includes('infl.'):
                retVal = 'Influence';
                break;
            case item.includes('rltr.'):
                retVal = 'Realtor';
                break;
            case item.includes('desf.'):
                retVal = 'Desired Features';
                break;
            case item.includes('desm.'):
                retVal = 'When Moving in';
                break;
            case item.includes('acti.'):
                retVal = 'Activities';
                break;
            default:
                break;
        }
        return retVal;
    }

    const getTitleByType = (item) => {
        let retVal = '';
        switch (item.type) {
            case 'agent':
                retVal = item.fname + ' ' + item.lname;
                break;
            case 'customer':
                retVal = item.fname + ' ' + item.lname;
                break;
            case 'property':
                retVal = item.name;
                break;
            case 'builder':
                retVal = item.name;
                break;
            default:
                break;
        }
        return retVal;
    }

    const getTextToDisplay = (item) => {
        let retHTML = '';
        Object.keys(item.highlight).forEach(function (key) {
            if (!key.includes('keyword')) {
                item.highlight[key].map((item2) => {
                    if (key === 'id' || key === 'org_id' || key === 'acti.id' || key === 'acti.org_id') {
                        return '';
                    } else {
                        if (retHTML === '') {
                            return retHTML = item2 + " (" + getChangeType(key) + ") ";
                        }
                        return retHTML = retHTML + '...  ' + item2 + " (" + getChangeType(key) + ") ";
                    }
                });
            }
        });
        return <Typography key={randomNumberBtwn()} variant="body2" component="p" className={classes.bodyCard}
            dangerouslySetInnerHTML={{ __html: retHTML }}>
        </Typography>;
    }

    const goToCustomerDetails = (item) => {
        if (item.type === 'customer') {
            history.push("/customer/" + item.id);
        }
    }

    const filterListData = () => {
        if (props.filterKey.type === 'all') {
            return props.list;
        } else {
            return props.list.filter(function (obj) {
                return obj['_source'].type === props.filterKey.type;
            });
        }
    }
    /*eslint-disable */
    const dudUrl = 'javascript:;';
    /*eslint-enable */

    return (
        <>
            {
                props.list.length > 0 &&
                <>
                    {/* <Box
                        ml={'135px'}
                        mt={'10px'}
                        container
                        direction="row"
                        justify="flex-start"
                        alignItems="center"
                    >
                        {(props.searchText.length > 0 && props.list.length > 0) ?
                            <Typography variant="h6" component="h5">
                                Search results for {"'" + props.searchText + "'"}
                            </Typography>
                            : ''}
                    </Box> */}
                    <Grid container justify="center" alignItems="center">
                        <Paper className={classes.paper}>
                            <Box
                                ml={'30px'}
                                mt={'20px'}
                                mb={'20px'}
                                direction="row"
                                justify="flex-start"
                                alignItems="center"
                            >
                                {(props.searchText.length > 0 && props.list.length > 0) ?
                                    <Typography variant="h6" component="h5">
                                        Search results for {"'" + props.searchText + "'"} {(props.filterKey && props.filterKey.type !== 'all') ? ' in ' + props.filterKey.type : ''}
                                    </Typography>
                                    : ''}
                            </Box>
                            <Divider variant="middle" />
                            <List>
                                {
                                    filterListData().map((item1, i1) => {
                                        return ([
                                            <ListItem key={i1}>
                                                <Grid container wrap="nowrap" spacing={2}>
                                                    <Grid item>
                                                        {getAvatarByType(item1['_source'])}
                                                    </Grid>
                                                    <Grid item xs>
                                                        <Typography className={classes.heading}>
                                                            {
                                                                item1['_source'].type === 'customer' ?
                                                                    <LinkCustom href={dudUrl} underline={'always'} onClick={() => { goToCustomerDetails(item1['_source']) }}>
                                                                        {getTitleByType(item1['_source'])}
                                                                    </LinkCustom> :
                                                                    getTitleByType(item1['_source'])}
                                                        </Typography>
                                                        <Typography className={classes.title} color="textSecondary" gutterBottom>
                                                            {getSubTitleByType(item1['_source'])}
                                                        </Typography>
                                                        {
                                                            getTextToDisplay(item1)
                                                        }
                                                        {/* <Typography variant="body2" component="p" className={classes.bodyCard}
                                                            dangerouslySetInnerHTML={{ __html: item1.value }}>
                                                        </Typography> */}
                                                    </Grid>
                                                </Grid>
                                            </ListItem>,
                                            props.list.length === i1 + 1 ? '' : <Divider variant="middle" key={randomNumberBtwn()} />
                                        ]);
                                    })
                                }
                            </List>
                        </Paper>
                    </Grid>
                </>
            }
        </>

    );
}
