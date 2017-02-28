'use strict';

const util = require('util');
const teslams = require('teslams');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync("./config.json").toString());

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: 'PlainText',
            text: output,
        },
        card: {
            type: 'Simple',
            title: `SessionSpeechlet - ${title}`,
            content: `SessionSpeechlet - ${output}`,
        },
        reprompt: {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            },
        },
        shouldEndSession,
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };
}

function getStatusResponse(callback) {
    teslams.get_vid( { email: config.username, password: config.password }, function (vid) {
        if (vid == undefined) {
            console.log("Error: Undefined vehicle id");
        } else {
            teslams.wake_up(vid, wakeUpResponse => {
                console.log(wakeUpResponse);
                teslams.get_charge_state(vid, chargeStateResponse => {
                    console.log(chargeStateResponse);
                    const sessionAttributes = {};
                    const cardTitle = 'Status';
                    const speechOutput = 'Battery is currently at ' + chargeStateResponse.battery_level + '%. You have ' + parseInt(chargeStateResponse.est_battery_range, 10) + ' miles of range left';
                    const shouldEndSession = true;

                    callback(sessionAttributes,
                        buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
                });
            });
        }
      }
    );
}

function getStartHVACResponse(callback) {
    teslams.get_vid( { email: config.username, password: config.password }, function (vid) {
        if (vid == undefined) {
            console.log("Error: Undefined vehicle id");
        } else {
            teslams.wake_up(vid, wakeUpResponse => {
                console.log(wakeUpResponse);
                teslams.auto_conditioning( { id: vid, climate: "on" }, climateResponse => {
                    console.log(climateResponse);
                    const sessionAttributes = {};
                    const cardTitle = 'A/C';
                    const speechOutput = 'Marvin\'s air condition is now on. Sweet!';
                    const shouldEndSession = true;

                    callback(sessionAttributes,
                        buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
                });
            });
        }
      }
    );
}

function handleSessionEndRequest(callback) {
    const cardTitle = 'Session Ended';
    const speechOutput = 'Bye bye!';
    const shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

// --------------- Events -----------------------

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

    // Dispatch to your skill's launch.
    const cardTitle = 'Session Ended';
    const speechOutput = 'Hi there! You can ask me about the status of Marvin or start the A/C.';
    const shouldEndSession = false;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;

    if (intentName === 'MarvinStatusIntent') {
        getStatusResponse(callback);
    } else if (intentName === 'MarvinStartHVACIntent') {
        getStartHVACResponse(callback);
    } else if (intentName === 'AMAZON.HelpIntent') {
        getWelcomeResponse(callback);
    } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        handleSessionEndRequest(callback);
    } else {
        throw new Error('Invalid intent');
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
}

exports.handler = (event, context, callback) => {
    try {
        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

        if (event.session.application.applicationId !== config.alexa_app_id) {
             callback('Invalid Application ID');
        }

        if (event.session.new) {
            onSessionStarted({ requestId: event.request.requestId }, event.session);
        }

        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            callback();
        }
    } catch (err) {
        callback(err);
    }
};