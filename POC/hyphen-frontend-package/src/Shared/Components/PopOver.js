import React from 'react';
import Popover from '@material-ui/core/Popover';

export default function PopOverMUI(props) {
    const [anchorEl, setAnchorEl] = React.useState(null);

    function handleClick(event) {
        setAnchorEl(event.currentTarget);
    }

    function handleClose() {
        setAnchorEl(null);
    }

    function renderLinkText() {
        let retVal = '';
        switch (props.htmlTag) {
            case 'checkbox':
                retVal = props.checkedItems.length === 0 ?
                    props.emptyText : (
                        (props.checkedItems.map(function (item) {
                            return item[props.joinProperty];
                        })).join(', ')
                    )
                break;
            case 'select':
                retVal = (props.checkedItems && props.checkedItems.length !== 0) ?
                    props.checkedItems : props.emptyText
                break;
            default:
                break;
        }
        return retVal;
    }

    const open = Boolean(anchorEl);
    const id = open ? props.id : undefined;

    return (
        <div>
            <span className="anchor-element font-weight-bold" id={id} name={id} aria-describedby={id}
                variant="contained" onClick={handleClick}>
                {
                    renderLinkText()
                }
            </span>
            <Popover
                id={id}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <div className={props.childrenWrapClass}>
                    {props.children}
                </div>
            </Popover>
        </div>
    );
}
