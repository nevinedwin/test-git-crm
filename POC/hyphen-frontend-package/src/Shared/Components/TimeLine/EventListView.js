import React from 'react';
import EventItem from './EventItem';

const EventListView = ({ events = [] }) => (
    <div className="timeline-list">
        {events.map((event, i) => (
            <EventItem event={event} key={i} />
        ))}
    </div>
);

const EventList = (EventListView);

export default EventList;