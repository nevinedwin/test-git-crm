import React from 'react';

let moment = require('moment');

const dateToText = time => {
    var sameMonth = false;
    var sameDate = false;

    var timeBackup = new Date(time);
    if (!time) return "never";

    var local = Date.now();
    var currentDate = new Date();

    var timeBackupMonth = timeBackup.getMonth();
    var localMonth = currentDate.getMonth();

    if (timeBackupMonth === localMonth) {
        sameMonth = true;
    }

    var timeBackupDate = timeBackup.getDate();
    var localDate = currentDate.getDate();

    if (timeBackupDate === localDate) {
        sameDate = true;
    }

    if (time instanceof Date) {
        time = time.getTime();
    } else if (typeof time === "string") {
        time = new Date(time).getTime();
    }

    if (local instanceof Date) {
        local = local.getTime();
    } else if (typeof local === "string") {
        local = new Date(local).getTime();
    }

    if (typeof time !== 'number' || typeof local !== 'number') {
        return;
    }

    var
        offset = Math.abs((local - time) / 1000),
        span = [],
        MINUTE = 60,
        HOUR = 3600,
        DAY = 86400;

    if (sameMonth && sameDate) {
        if (offset <= MINUTE) span = ['', 'less than a minute'];
        else if (offset < (MINUTE * 60)) span = [Math.round(Math.abs(offset / MINUTE)), 'min'];
        else if (offset < (HOUR * 24)) span = 'Today At ' + moment(timeBackup).format('hh:mm a');
    } else {
        if (offset < (DAY * 1)) span = 'Yesterday At ' + moment(timeBackup).format('hh:mm a');
        else if (offset >= (DAY * 1) && offset < (DAY * 7)) span = [Math.round(Math.abs(offset / DAY)), 'day'];
        else span = moment(timeBackup).format('MMMM Do YYYY, h:mm a');
    }

    if (typeof span === "string") {
        return span;
    } else {
        span[1] += (span[0] === 0 || span[0] > 1) ? 's' : '';
        span = span.join(' ');
        return span + ' ago';
    }
}

const getEventTypeIcon = type => {
    let retVal ='';
    switch (type) {
        case 'note':
            retVal = <span className="icon icon-note"></span>;
            break;
        case 'mail_send':
            retVal = <span className="icon icon-mail"></span>;
            break;
        case 'mail_received':
            retVal = <span className="icon icon-mail"></span>;
            break;
        case 'phone':
            retVal = <span className="icon icon-call"></span>;
            break;
        case 'appointment':
            retVal = <span className="icon icon-calendar"></span>;
            break;
        case 'community_visit':
            retVal = <span className="icon icon-calendar"></span>;
            break;
        default:
            break;
    }
    return retVal;
}

const getEventCSSClass = type => {
    let retVal ='';
    switch (type) {
        case 'note':
            retVal = 'note';
            break;
        case 'mail_send':
            retVal = 'mail';
            break;
        case 'mail_received':
            retVal = 'mail';
            break;
        case 'phone':
            retVal = 'call';
            break;
        case 'appointment':
            retVal = 'calendar';
            break;
        case 'community_visit':
            retVal = 'calendar';
            break;
        default:
            break;
    }
    return retVal;
}

const EventItemView = ({ event, classes }) => (
    <>
        {event.title ?
            (<div className="timeline-block category-icon-wrap">
                <div className={"timeline-left-area " + getEventCSSClass(event.type)}>
                    <div className="category-icon d-flex justify-content-center align-items-center medium px-2 py-2">
                        {getEventTypeIcon(event.type)}
                    </div>
                </div>
                <div className="timeline-message">
                    <h4>{event.title}</h4>
                    <p className="mb-1">{event.desc}</p>
                    <span className="time">{dateToText(event.date)}</span>
                </div>
            </div>) :
            (<div className="timeline-block timeline-difference">
                <div className="timeline-left-area">
                    <div className="time-difference d-flex justify-content-center align-items-center">{event.dateText}</div>
                </div>
                <div className="timeline-message w-100">

                    <hr />
                </div>
            </div>)
        }
    </>
);

const EventItem = (EventItemView);

export default EventItem;