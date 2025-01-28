import React from "react";
import { openSnackbar } from '../../Shared/Components/Notifier';

const ErrorGrowl = HocComponent => {

    return function ({ ...props }) {
        return <>
            {props.error && openSnackbar({
                message: props.errorMessage,
                variant: "error"
            })}
            <HocComponent {...props} />
        </>;
    };
};

export default ErrorGrowl;
