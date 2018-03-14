/*

    This is a sample bot that provides a simple todo list function
    and demonstrates the Botkit storage system.

    Botkit comes with a generic storage system that can be used to
    store arbitrary information about a user or channel. Storage
    can be backed by a built in JSON file system, or one of many
    popular database systems.

    See:

        botkit-storage-mongo
        botkit-storage-firebase
        botkit-storage-redis
        botkit-storage-dynamodb
        botkit-storage-mysql

*/

const Bluebird = require('bluebird');

module.exports = function(controller) {

    controller.hears([':doughnut:', ':donut:', ':donuttime:', ':donut2:'], 'ambient', function(bot, message) {
        console.log('message', message);
        let sender = message.user.replace(/[<@>]/g, '');
        controller.storage.users.get(message.user)
            .then((senderObj) => {
                console.log('hears(), after getting senderObj, which is ' + JSON.stringify(senderObj));

                const dailyDonutsDonated = senderObj && senderObj.dailyDonutsDonated;
                if (senderObj && dailyDonutsDonated >= 6 ) {

                    bot.reply(message, "You've given your last donut for the day. You've truly shown there's no I in donut. Donut worry be happy! You'll have a fresh box of donuts tomorrow.");
                } else {
                    const recipientsArr = message.text.match(/\<@(.*?)\>/g);
                    // TODO: filter out the sender from the recipients list (anticheat).
                    const count = message.text.match(/\:d(.*?)\:/g).length;
                    const total = recipientsArr.length * count;
                    const remain = 6 - dailyDonutsDonated;

                    if (total > remain) {
                        bot.reply(message, "Your generosity knows no bounds! Unfortunately your donut box does know bounds. You don't have enough in there to send all of those donuts.");
                    } else {
                        recipientsArr.forEach(recipient => {
                            let getter = recipient.replace(/[<@>]/g, '');

                            // TODO async timing
                            notifyRecipeintOfDonutGiven(getter, sender, count);
                            notifySenderOfDonutsSent(getter, sender, count);
                        });
                    }
                }
            });
    });

    function notifyRecipeintOfDonutGiven(recipientId, sender, count) {
        console.log('top of notifyRecipeintOfDonutGiven');

        return controller.storage.users.get(recipientId)
            .then((recipient) => {
                console.log(`notifyRecipeintOfDonutGiven, recipient.id is ${ recipient.id }`);

                let text = `You received ${count} donut :donuttime: from <@${sender}>!`;
                let toSave = {};

                if (recipient) {
                    recipient.lifetimeDonuts += count;
                    text += ` You have received ${ recipient.lifetimeDonuts } donuts in total.`;

                    toSave = {
                        id: recipient.id,
                        dailyDonutsDonated: recipient.dailyDonutsDonated,
                        lifetimeDonuts: recipient.lifetimeDonuts
                    };
                }
                else {
                    toSave = {
                        id: recipientId,
                        dailyDonutsDonated: 0,
                        lifetimeDonuts: count
                    };
                }

                let message = {
                  text: text,
                  channel: recipientId // a valid slack channel, group, mpim, or im ID
                };

                bot.say(message, function(res, err) {
                    console.log(res, err, 'Notified reciever');
                });

                return controller.storage.users.save(toSave);
            });
    }

    function notifySenderOfDonutsSent(recipient, sender, count) {
        controller.storage.users.get(sender)
            .then((donor) => {
                return controller.storage.users.save({
                    id: donor ? donor.id : sender,
                    dailyDonutsDonated: donor ? donor.dailyDonutsDonated + count : count,
                    lifetimeDonuts: donor ? donor.lifetimeDonuts : 0
                });
            })
            .then(() => {
                let message = {
                    text: `<@${recipient}> received ${count} donuts from you. You have ${6 - count} donuts remaining donuts left to give out today.`,
                    channel: sender // a valid slack channel, group, mpim, or im ID
                };

                bot.say(message, function(res, err) {
                    console.log(res, err, 'Notified sender');
                });
            })
            .catch((error) => console.log(error));
    }

    // Returns a promise that resolves to a array of all users
    // in descending order by lifetimeDonuts.
    function getLeaderboardData() {
        const BLACKLIST = [
            'D0GK339RN', // slackbot
            'D9Q0NDWKF', // climatebot
            'D9PA82SGH', // Birthday Bot
            'D38NAD5CZ', // heytaco
            'D9QU70Y3H' // sameroom
        ];

        // For now, just get all rows from users table and put them into a array, sort them.
        return controller.storage.users.all(
            (error, users) => {
                if (error) {
                    throw new Error(error);
                }

                return users;
            }
        ).then(
            (users) => {
                return users.filter(
                    (user) => BLACKLIST.indexOf(user.id) === -1
                )
                .sort(
                    (a, b) => b.lifetimeDonuts - a.lifetimeDonuts
                );
            }
        );
    }

    // Returns a promise.
    function getUserData(userId) {
        return controller.storage.users.get(
            userId,
            (error, user) => {
                if (error) {
                    throw new Error(error);
                }

                return user;
            }
        );
    }
}
