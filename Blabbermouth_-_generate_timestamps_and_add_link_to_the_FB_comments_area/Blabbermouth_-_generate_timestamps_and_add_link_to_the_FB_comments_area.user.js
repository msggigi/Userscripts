// ==UserScript==
// @name        Blabbermouth - generate timestamps and add link to the fb comments area
// @namespace   darkred
// @version     1.1.1
// @date        2020.7.30
// @description Generates missing timestamps or converts the existing ones in relative format, and adds link to the fb comments area
// @author      darkred
// @license     MIT
// @include     /^(https?:)?\/\/(www\.)?blabbermouth\.net\/(news|cdreviews|dvdreviews)?/
// @exclude     /^(https?:)?\/\/(www\.)?blabbermouth\.net\/(cdreviews|dvdreviews)(\/page|$)/
// @include     https://www.facebook.com/plugins/feedback.php*
// @grant       none
// @require     https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.min.js
// @supportURL  https://github.com/darkred/Userscripts/issues
// @icon        https://www.blabbermouth.net/assets/favicon-309148577f1b67c003487c069cccf8731e6f68e4d847c5576d6f5453b083c27a.png
// ==/UserScript==


/* global moment */
'use strict';


// Customize the strings in the locale to display "1 minute ago" instead of "a minute ago" (https://github.com/moment/moment/issues/3764#issuecomment-279928245)
moment.updateLocale('en', {
	relativeTime: {
		future: 'in %s',
		past: '%s ago',
		s: 'seconds',
		m: '1 minute',
		mm: '%d minutes',
		h: '1 hour',
		hh: '%d hours',
		d: '1 day',
		dd: '%d days',
		M: '1 month',
		MM: '%d months',
		y: '1 year',
		yy: '%d years'
	}
});

function convertToLocalTimezone(timestamp) {
	// (the timestamp is in ISO 8601 format and its trailing Z means that it's in UTC )
	// 2020-03-05T15:40:38.000Z
	let initialTimestamp = timestamp;
	if (moment(initialTimestamp, moment.ISO_8601, true).isValid()) {
		// let convertedToLocalTimezone = moment(initialTimestamp.replace('Z','')  + '-05:00', 'YYYY-MM-DDTHH:mm:ssZ');		// the server's timezone is GMT-5
		let convertedToLocalTimezone = moment(initialTimestamp.replace('Z','')  + '-03:53', 'YYYY-MM-DDTHH:mm:ssZ');		// the server's timezone is GMT-4 plus 7 min, in order to sync with the relevant post timestamps in both Twitter and FB blabbbermouth pages
		publishedTimeLTZ = convertedToLocalTimezone.fromNow();
		let format = 'YYYY-MM-DD HH:mm:ss';
		publishedTimeLTZtitle = convertedToLocalTimezone.format(format);
	}
}

function recalc(existingTimestampElement, format, notitle) {
	setInterval(function() {
		if (existingTimestampElement && moment(existingTimestampElement.title, format, true).isValid()) {
			existingTimestampElement.textContent = moment(existingTimestampElement.title).fromNow();
		} else if (notitle === true) {
			existingTimestampElement.innerText = moment(existingTimestampElement.innerText.trim()).fromNow();
		}
	}, 1 * 60 * 1000);		// repeat every 1 minute
}


if (
	window.location.href.endsWith('blabbermouth.net/') ||
	window.location.href.endsWith('blabbermouth.net/news') ||
	window.location.href.includes('blabbermouth.net/news/page/')
) {

	let options = {
		root: null,
		rootMargin: '0px',
		threshold: 0
	};

	let callback = (entries, observer) => {
		entries.forEach(entry => {
			if (entry.isIntersecting && !entry.target.classList.contains('in-viewport') ) {
				entry.target.classList.add('in-viewport');

				var xhr = new XMLHttpRequest();
				var url = entry.target.parentElement.parentElement.firstElementChild.firstElementChild.href;
				xhr.open('GET', url, true);	// XMLHttpRequest.open(method, url, async)
				xhr.onload = function () {

					let container = document.implementation.createHTMLDocument().documentElement;
					container.innerHTML = xhr.responseText;

					let publishedTimestamp = container.querySelector(
						'meta[property="article:published_time"]'
					).content;

					convertToLocalTimezone(publishedTimestamp);

					entry.target.textContent = publishedTimeLTZ;
					entry.target.title = publishedTimeLTZtitle;

					recalc(entry.target, 'YYYY-MM-DD HH:mm:ss');

				};
				xhr.send();

			}
		});
	};

	let observer = new IntersectionObserver(callback, options);

	var allTimestamps = document.querySelectorAll('span.date-time');
	allTimestamps.forEach((element) => {
		observer.observe(element);
	});


} else if (window.location.href.includes('blabbermouth.net/news/')) {
	if (
		document.querySelector('meta[property="article:published_time"]') !==
		null
	) {
		var publishedTimestamp = document.querySelector(
			'meta[property="article:published_time"]'
		).content;
	}


	console.log('publishedTimestamp: ' + publishedTimestamp);

	var publishedTimeLTZ, publishedTimeLTZtitle;

	convertToLocalTimezone(publishedTimestamp);

	let existingTimestampElement = document.querySelector('.date-time');

	existingTimestampElement.textContent = publishedTimeLTZ;
	existingTimestampElement.title = publishedTimeLTZtitle;

	recalc(existingTimestampElement, 'YYYY-MM-DD HH:mm:ss');


} else if (
	(window.location.href.includes('blabbermouth.net/cdreviews/') ||
	window.location.href.includes('blabbermouth.net/dvdreviews/')) &&
	!window.location.href.includes('/page/')
) {
	//--- Double-check that this iframe is on the expected domain:
	if (/blabbermouth\.net/i.test(location.host)) {
		console.log('Userscript is in the MAIN page.');

		// 2019-10-17T15:32:18.000Z

		if (
			document.querySelector(
				'meta[property="article:published_time"]'
			) !== null
		) {
			publishedTimestamp = document.querySelector(
				'meta[property="article:published_time"]'
			).content;
		}

		console.log(publishedTimestamp);

		var currentURL = window.location.href;

		convertToLocalTimezone(publishedTimestamp);

		var commentcount = '';

		var HTML = `
<p class="byline-single vcard">
<span class="date-time">${publishedTimeLTZ}</span>
<span class="date-comments">
<a data-permalink="${currentURL}" href="#comments">${commentcount}</a>
<a href="#comments">
Comments
</a>
</span>
</p>
`;

		if (document.querySelector('.entry-content') !== null) {
			document
				.querySelector('.entry-content')
				.insertAdjacentHTML('beforebegin', HTML);
			document.querySelector('.date-time').title = publishedTimeLTZtitle;

			let newDateTimeElement = document.querySelector('.date-time');
			recalc(newDateTimeElement, 'YYYY-MM-DD HH:mm:ss');
		}

		// Wait fof messages (from iframe)
		window.addEventListener(
			'message',
			function addFbCounter(e) {
				// something from an unknown domain, or doesn't contain the string "Comment" let's ignore it
				if (e.origin !== 'https://www.facebook.com' || e.data.indexOf(' Comment') === -1) {
					return;
				}
				console.log('Received message: ' + e.data);
				document.querySelector(
					'#main > article > p > span.date-comments > a:nth-child(1)'
				).innerText = e.data.replace(/ Comments?/i,'');
				window.removeEventListener('message', addFbCounter);
			},
			false
		);
		console.log('Waiting for Message 1, from iframe...');
	}
}  else if (window.location.href.includes('facebook.com')) {

	console.log('Userscript is in the FRAMED page.');

	var selector = '._50f7';
	window.parent.postMessage(
		document.querySelector(selector).innerText,
		'https://www.blabbermouth.net/cdreviews/'
	);
}
