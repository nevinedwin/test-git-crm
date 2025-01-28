import React, { Component } from "react";

import SearchBtn from '../../Shared/Components/Search';
import CardsCustom from '../../Shared/Components/Cards';
import SelectBox from '../../Shared/Components/SelectBox';

class Search extends Component {

    constructor(props, context) {
        super(props, context);
        this.events = this.bindEvents();
        this.state = {
            searchText: '',
            filterKey: {
                type: 'all'
            },
            typeList: ['all', 'agent', 'customer', 'property', 'builder']
        };
    }

    bindEvents() {
        return {
            searchApp: this.searchApp.bind(this),
            updateFormAction: this.updateFormAction.bind(this)
        };
    }

    updateFormAction(value, name) {
        let filterKey = { ...this.state.filterKey };
        if (value) {
            filterKey[name] = value;
        }
        this.setState({ filterKey });
    }

    searchApp(searchKey) {
        this.setState({ searchText: searchKey });
        this.props.searchApp(searchKey);
    }

    render() {
        return (
            <div className="container">
                <div className="px-4 pt-5 pb-3">
                    <div className="row">
                        <div className="col-10 mx-auto">
                            <SearchBtn
                                placeHolder="Search"
                                storageKey="globalSearchKey"
                                onChangeSearchAction={this.events.searchApp}
                                resultLength={this.props.searchResult.length}
                                alternateListLength={0} />
                        </div>
                        <div className="col-2">
                            <SelectBox
                                id="type"
                                currentValue={this.state.filterKey.type}
                                updateAction={this.events.updateFormAction}
                                list={this.state.typeList}>
                            </SelectBox>
                        </div>
                    </div>
                    {
                        this.props.searchResult.length > 0 &&
                        <div className="row mt-3">
                            <div className="col-12 mx-auto">
                                <CardsCustom
                                    list={this.props.searchResult}
                                    searchText={this.state.searchText}
                                    filterKey={this.state.filterKey} />
                            </div>
                        </div>
                    }
                </div>
            </div>
        );
    }
}

export default Search;
