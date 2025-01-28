import React from "react";
import { locStrings } from "../../Services/Localization";

export default function translate(key) {
    return Component => {
        class TranslationComponent extends React.Component {
            render() {
                const currentLanguage = locStrings.getLanguage();
                return <Component {...this.props} strings={locStrings[key]} currentLanguage={currentLanguage} />
            }
        }
        return TranslationComponent;
    };
}