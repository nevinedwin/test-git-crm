import { Auth } from "aws-amplify";
import { ManageLocalStorage } from "../Services/LocalStorage";

export const randomNumberBtwn = (min = 1, max = 100000) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const diffYMDHMS = (date1, date2) => {

    let years = date1.diff(date2, 'year');
    date2.add(years, 'years');

    let months = date1.diff(date2, 'months');
    date2.add(months, 'months');

    let days = date1.diff(date2, 'days');
    date2.add(days, 'days');

    let hours = date1.diff(date2, 'hours');
    date2.add(hours, 'hours');

    let minutes = date1.diff(date2, 'minutes');
    date2.add(minutes, 'minutes');

    let seconds = date1.diff(date2, 'seconds');

    if (years) {
        return years + ' Yrs';
    }
    if (months) {
        return months + ' Mos';
    }
    if (days) {
        return days + ' Days';
    }
    if (hours) {
        return hours + ' Hrs';
    }
    if (minutes) {
        return minutes + ' Mins';
    }
    if (seconds) {
        return seconds + ' Sec';
    }

    return '0 Sec';
}

export const getUniqueFromArrayByKey = (arr, comp) => {
    const unique = arr
        .map(e => e[comp])
        // store the keys of the unique objects
        .map((e, i, final) => final.indexOf(e) === i && i)
        // eliminate the dead keys & store unique objects
        .filter(e => arr[e]).map(e => arr[e]);

    return unique;
}

export const clearStorageAndAmplify = () => {
    try {
        Auth.signOut();
        ManageLocalStorage.clear();
    } catch (error) {

    }
}