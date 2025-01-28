import React from 'react';
import TextField from '@material-ui/core/TextField';
import { withStyles } from '@material-ui/core/styles';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

const TextFieldCustom = withStyles(theme => ({
  root: {
    display: 'flex',
    fontWeight: '600'
  },
}))(TextField);

const ContentEditable = WrappedComponent => {
  return class extends React.Component {

    state = {
      editing: false,
      currentValue: this.props.value
    };

    toggleEdit = (e) => {
      e.stopPropagation();
      if (this.state.editing) {
        this.cancel();
      } else {
        this.edit();
      }
    };

    edit = () => {
      this.setState({
        editing: true
      }, () => {
        // this.domElm.focus();
      });
    };

    save = () => {
      this.setState({
        editing: false
      }, () => {
        if (this.props.onChange && this.isValueChanged()) {
          this.props.onChange({
            target: {
              name: this.props.name,
              value: this.state.currentValue
            }
          });
        }
      });
    };

    cancel = () => {
      this.setState({
        editing: false
      });
    };

    isValueChanged = () => {
      return this.props.value !== this.state.currentValue;
    };

    handleKeyDown = (e) => {
      const { key } = e;
      switch (key) {
        case 'Enter':
        case 'Escape':
          this.save();
          break;
        default:
      }
    };

    handlePropertyChange = (event) => {
      this.setState({
        currentValue: event.target.value
      }, () => {
      });
    };

    handleClickAway = () => {
      this.save();
    };

    render() {
      let editOnClick = true;
      const { editing } = this.state;
      if (this.props.editOnClick !== undefined) {
        editOnClick = this.props.editOnClick;
      }
      return (
        <>
          {
            editing ?
              (
                <ClickAwayListener onClickAway={this.handleClickAway}>
                  <TextFieldCustom
                    value={this.state.currentValue}
                    onChange={this.handlePropertyChange}
                    onBlur={this.save}
                    onKeyDown={this.handleKeyDown}
                  />
                </ClickAwayListener>
              )
              :
              (
                <WrappedComponent
                  className={editing ? this.props.classnameslist + ' editing' : this.props.classnameslist + ''}
                  onClick={editOnClick ? this.toggleEdit : undefined}
                  contentEditable={editing}
                  suppressContentEditableWarning={true}
                  ref={(domNode) => {
                    this.domElm = domNode;
                  }}
                  onBlur={this.save}
                  onKeyDown={this.handleKeyDown}
                  {...this.props}
                >
                  {this.state.currentValue}
                </WrappedComponent>
              )
          }
        </>
      )
    }
  }
};

export default ContentEditable;