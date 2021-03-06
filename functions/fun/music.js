const ytdl = require('ytdl-core');
var search = require('youtube-search');
const auth = require('../../auth/auth.json')
var config = require('../../config.json')
var locales = require('../../locales/' + config.lang + '.json')
var perms = require('../administration/perms.js')

var opts = {
    part: 'snippet',
    maxResults: 5,
    key: auth.apikey,
    type: 'video',
    fields: 'items(id(videoId),snippet(title)),pageInfo'
};
var streamOptions = { seek: 0, volume: 0.5 };
var queue = []
var looprunning = false
var length_cache = 0
var looplength = 0
let voiceconnection
var link_cache = " "
var distimeout
var distimeout2
let player
var length = 0;
var joined = false;

function checkrightchannel(message, link, kill) {
    if (kill === undefined) {
        kill = false
    }
    if (message.member.voiceChannelID === config.voicechannel) {
        if (message.channel.id === config.channel) {
            if (link !== link_cache) {
                if (kill === false) {
                    if (validateYouTubeUrl(link) === true) {
                        return true
                    }
                    else {
                        message.reply(locales.music.validlink)
                    }
                }
                else {
                    return true
                }
            }
            else {
                message.reply(locales.music.duplicate)
            }
        }
        else {
            message.reply(locales.music.wrongchannel1 + config.channel + locales.music.wrongchannel2)
        }
    }
    else {
        message.reply(locales.music.musicchannel)
    }
}

function validateYouTubeUrl(link) {
    if (link !== undefined && link !== '' && link !== null) {
        var regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\?v=)([^#\&\?]*).*/;
        var match = link.match(regExp);
        if (match && match[2].length === 11) {
            return (true)
        }
        else {
            return (false)
        }
    }
    else {
        return (false)
    }
}

function vlength(message, loop, link) {
    if (loop === false) {
        if (length === length_cache) {
            setTimeout(function () { vlength(message, false) }, 200);
        }
        else {
            length_cache = length
            disconnect(message)
        }
    }
    else {
        if (looplength === length_cache) {
            setTimeout(function () { vlength(message, true, link) }, 200);
        }
        else {
            playloop(message, link)
        }
    }
}

function play(message) {
    length = (queue[0].duration * 1000)
    message.channel.setTopic(locales.music.nowplaying + queue[0].title + locales.music.length + sectomin(queue[0].duration))
    stream = ytdl(queue[0].url, { filter: (format) => ['45'], audioonly: true, highWaterMark: 1024 * 1024 * 50 });
    player = voiceconnection.playStream(stream, streamOptions)
    queue.shift()
    vlength(message, false)
}

function disconnect(message) {
    distimeout = setTimeout(function () {
        if (queue[0] !== undefined) {
            play(message)
        }
        else {
            if (message.guild.voiceConnection !== null) {
                message.channel.send(locales.music.songend)
                killplayer(message)
            }
        }
    }, length)
}

function sectomin(time) {
    var hr = ~~(time / 3600);
    var min = ~~((time % 3600) / 60);
    var sec = time % 60;
    var sec_min = "";
    if (hr > 0) {
        sec_min += "" + hr + ":" + (min < 10 ? "0" : "");
    }
    sec_min += "" + min + ":" + (sec < 10 ? "0" : "");
    sec_min += "" + sec;
    return sec_min + " min";
}

function playloop(message, link) {
    looprunning = true
    const stream = ytdl(link, { filter: (format) => ['45'], audioonly: true, highWaterMark: 1024 * 1024 * 50 });
    player = voiceconnection.playStream(stream, streamOptions)
    distimeout2 = setTimeout(() => {
        if (looprunning === true) {
            playloop(message, link)
        }
    }, looplength);
}

function killplayer(message) {
    player.end()
    queue = []
    clearTimeout(distimeout)
    clearTimeout(distimeout2)
    message.guild.voiceConnection.disconnect();
    if (message.channel.id === config.channel) {
        message.channel.setTopic(locales.music.startsong)
    }
    joined = false
    length = 0
    link_cache = ''
    voiceconnection = ''
    length_cache = 0
    looprunning = false
    player.end()
}

module.exports = {
    streamyt: function (message, link) {
        if (checkrightchannel(message, link) === true) {
            link_cache = link
            var obj = { url: link, title: '', duration: '', gathered: false }
            queue.push(obj)
            if (joined === false) {
                joined = true
                length_cache = length;
                ytdl.getInfo(queue[0].url).then(info => {
                    length = (info.length_seconds * 1000)
                    message.channel.setTopic(locales.music.nowplaying + info.title + locales.music.length + sectomin(info.length_seconds))
                    message.reply(info.title + locales.music.now)
                });
                if (streamOptions === undefined) {
                    streamOptions = { seek: 0, volume: 1 };
                }
                const stream = ytdl(queue[0].url, { filter: (format) => ['45'], audioonly: true, highWaterMark: 1024 * 1024 * 50 });
                message.member.voiceChannel.join().then(connection => {
                    player = connection.playStream(stream, streamOptions)
                    voiceconnection = connection
                    vlength(message, false)
                }).catch(console.error);
                queue.shift()
            }
            for (var i = 0; i < queue.length; i++) {
                if (queue[i].gathered === false) {
                    ytdl.getInfo(queue[i].url).then(info => {
                        i = i - 1
                        queue[i].title = info.title
                        queue[i].duration = info.length_seconds
                        queue[i].gathered = true
                        message.reply(info.title + locales.music.addwaitlist)
                    })
                }
            }
        }

    },
    printqueue: function (message, Discord) {
        if (queue[0] !== undefined) {
            const queueembed = new Discord.RichEmbed();
            queueembed
                .setColor('#735BC1')
                .setTitle(locales.music.waitlist)
            for (var i = 0; i < queue.length; i++) {
                if (queue[i] !== undefined) {
                    queueembed
                        .addField((i + 1) + '. : ', queue[i].title + locales.music.length + sectomin(queue[i].duration))
                }
            }
            queueembed
                .setFooter(locales.request + message.author.tag, message.author.avatarURL, 'https://scarvite.6te.net')
            message.channel.send(queueembed)
        }
        else {
            message.channel.send(locales.music.emptywaitlist)
        }
    },
    killstream: function (message) {
        if (message.guild.voiceConnection) {
            if (checkrightchannel(message, '56', true) === true) {
                if (joined === true) {
                    killplayer(message)
                }
                else {
                    if (arguments.callee.caller.name !== 'stop') {
                        message.reply(locales.music.nothingplaying)
                    }
                    else {
                        return
                    }
                }
            }
        }
        else {
            if (arguments.callee.caller.name !== 'stop') {
                message.reply(locales.music.notconnected)
            }
        }
    },
    /*skip: function(message){
        if(Tiggy Dein einsatzt, reactions abfragen){
            player.end()
            play(message)
        }
        else{
            message.channel.send(locales.irgendwas)
        }
    }, */
    loopsong: function (message, link) {
        if (checkrightchannel(message, link) === true) {
            if (joined === false) {
                ytdl.getInfo(link).then(info => {
                    looplength = (info.length_seconds * 1000)
                    message.channel.setTopic(locales.music.nowplaying + info.title + locales.music.loop + locales.music.length + sectomin(info.length_seconds))
                }).then(
                )
                if (streamOptions === undefined) {
                    streamOptions = { seek: 0, volume: 1 };
                }
                joined = true
                message.member.voiceChannel.join().then(connection => {
                    player = connection.playStream(stream, streamOptions)
                    vlength(message, true, link)
                    voiceconnection = connection
                }).catch(console.error);
            }
            else {
                message.reply(locales.music.waitloop)
            }
        }
    },
    pause: function (message) {
        if (player.paused === false) {
            player.pause()
        }
        else {
            message.reply(locales.music.nothingtopause)
        }
    },
    resume: function (message) {
        if (player.paused === true) {
            player.resume()
        }
        else {
            message.reply(locales.music.nothingtoresume)
        }
    },
    volume: function (vol, message) {
        if (perms.checkperms(message) === true) {
            if (vol <= 5 && vol >= 0) {
                streamOptions.volume = vol
                player.setVolume(vol)
                message.reply(locales.music.volume1 + player.volume + locales.music.volume2)
            }
            else {
                message.reply(locales.music.numbervolume)
            }
        }
        else {
            message.reply(locales.music.bug)
        }
    },
    searchyt: function (message, term1, term2, term3, term4, Discord) {
        if (term1 !== undefined) {
            if (term2 !== undefined) {
                if (term3 !== undefined) {
                    if (term4 !== undefined) {
                        term = term1 + ' ' + term2 + ' ' + term3 + ' ' + term4
                        this.search(message, term, Discord)
                    }
                    else {
                        term = term1 + ' ' + term2 + ' ' + term3
                        this.search(message, term, Discord)
                    }
                }
                else {
                    term = term1 + ' ' + term2
                    this.search(message, term, Discord)
                }
            }
            else {
                term = term1
                this.search(message, term, Discord)
            }
        }
        else {
            message.channel.send(locales.music.validsearch)
            return
        }
    },
    search: function (message, term, Discord, err) {
        search(term, opts, function (err, results) {
            if (err) return console.log(err)
            //message.channel.send(term)
            //console.log(results)
            const searchembed = new Discord.RichEmbed();
            searchembed
                .setColor('#0099ff')
                .addField(":one:", results[0]["title"])
                //.addBlankField()
                .addField(":two:", results[1]["title"])
                //.addBlankField()
                .addField(":three:", results[2]["title"])
                //.addBlankField()
                .addField(":four:", results[3]["title"])
                //.addBlankField()
                .addField(":five:", results[4]["title"])
                .setFooter(locales.request + message.author.tag, message.author.avatarURL)
            //message.channel.send(searchembed) 
            message.channel.send(searchembed)//.then(message => {
            message.react('1⃣')
                .then(r => {
                    message.react('2⃣')
                        .then(r => {
                            message.react('3⃣')
                                .then(r => {
                                    message.react('4⃣')
                                        .then(r => { message.react('5⃣'); })
                                })
                        })
                });
            const searchft = (reaction, user) => {
                return ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣'].includes(reaction.emoji.name) && user.id == message.author.id;
            };
            message.awaitReactions(searchft, { max: 1, time: 15000 }).then(collected => {
                if (collected.first().emoji.name == '1⃣') {
                    module.exports.streamyt(message, results[0]["link"])
                    //message.delete()
                    return;
                }

                if (collected.first().emoji.name == '2⃣') {
                    module.exports.streamyt(message, results[1]["link"])
                    //message.delete()
                    return;
                }
                if (collected.first().emoji.name == '3⃣') {
                    module.exports.streamyt(message, results[2]["link"])
                    //message.delete()
                    return;
                }
                if (collected.first().emoji.name == '4⃣') {
                    module.exports.streamyt(message, results[3]["link"])
                    //message.delete()
                    return;
                }
                if (collected.first().emoji.name == '5⃣') {
                    module.exports.streamyt(message, results[4]["link"])
                    //message.delete()
                    return;
                }

            }).catch(collected => {
                message.reply(locales.music.noreact)
            })
            //})
        }
        )

    }
}

