import React from "react";
import { withStyles } from '@material-ui/core/styles';
import LinearProgress from '@material-ui/core/LinearProgress';
import '../../Assets/scss/Loader.scss';

const ColorLinearProgress = withStyles({
    colorPrimary: {
        backgroundColor: '#F37620',
    },
    barColorPrimary: {
        backgroundColor: '#ffdac1',
    },
})(LinearProgress);

const Loader = HocComponent => {
    return function ({ ...props }) {
        return (
            <>
                {props.isLoading && (
                    <div className={props.classes().loaderRoot}>
                        <ColorLinearProgress style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            left: 0,
                            zIndex: 9999
                        }} />
                    </div>
                )}
                <HocComponent {...props} />
            </>
        );
    };
};

export default Loader;
