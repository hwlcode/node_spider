/**
 * 用superagent取代request,superagent支持异步ajax api,而且支持链接调用
 * 参考：http://visionmedia.github.io/superagent/
 */
var request = require("superagent");
var cheerio = require("cheerio");
var async = require("async");

var fs = require("fs");
var path = require("path");

var startUrl = 'https://www.zhihu.com/question/34937418';
var userAgent = '.set(\'User-Agent\', \'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36\')';
var photos = []; // 存储所有图片链接的数组
var count = 0;
var proxyIps = []; // 存储可用的代理地址

require('superagent-proxy')(request);
require('superagent-charset')(request);

function start() {
    getProxyIp(function (ips) {
        var proxy = ips[Math.floor(Math.random()*ips.length)];
        getInitUrlList(proxy);
    });
}
//请求首屏数据
function getInitUrlList(proxy) {
    request.get(startUrl)
        //设置代理
        .proxy('http://'+proxy.ip+':'+proxy.port)
        //设置字符编码
        .charset('utf-8')
        //设置请求头， User-Agent:随便找个浏览器copy一个过来
        .set('User-Agent', userAgent)
        // 超时控制
        .timeout({
            response: 5000,  // Wait 5 seconds for the server to start sending,
            deadline: 60000, // but allow 1 minute for the file to finish loading.
        })
        .end(function (err, result) {
            if(err){
                console.log('代理无法连接，正在重试其他代理，请稍候>>>');
                start();
                return;
            }
            console.log('发现可用代理，准备抓取中>>>');
            var $ = cheerio.load(result.text);
            var answerList = $( "#QuestionAnswers-answers" );
            answerList.map(function( i, answer ){
                var images = $( answer ).find('[itemprop="image"]');
                images.map(function( i, image ){
                    photos.push( $(image).attr( "content" ) );
                });
            });
            console.log( "已为您成功抓取 " + photos.length + " 张图片的链接>>>" );
            getIAjaxUrlList(23);
        });
}

//点击更多，请求ajax异步数据
function getIAjaxUrlList(offset) {
    request.get(startUrl)
        .set('User-Agent', userAgent)
        .query({ limit: 20 })
        .query({ offset: offset })
        .query({ sort_by: 'default' })
        .then(function (result) {
            if( offset < 100 ) {
                // 把所有的数组元素拼接在一起
                var $ = cheerio.load( escape2Html(result.text) );
                var answerList = $( "#QuestionAnswers-answers" );
                answerList.map(function( i ,answer ){
                    var images = $( answer ).find( '[itemprop="image"]' );
                    images.map(function( i, image ){
                        photos.push( $(image).attr("content") );
                    });
                });
                setTimeout(function () {
                    offset += 20;
                    console.log("已为您成功抓取 " + photos.length + " 张图片的链接>>>");
                    getIAjaxUrlList(offset);
                }, 300)
            }else{
                console.log( "图片链接全部获取完毕，一共有 " + photos.length + " 条图片链接>>>" );
                return downloadImg( 10 );
            }
        })
        .catch( function (error) {
            console.log( error );
        });
}

// 下载所有的图片
function downloadImg(asyncNum) {
    // 有一些图片链接地址不完整没有“http:”头部,帮它们拼接完整
    for( var i=0; i<photos.length; i++ ){
        if( photos[i].indexOf( "http" ) == -1 ) {
            photos[i] = "http:" + photos[i]
        }
    };

    console.log( "即将异步并发下载图片，当前并发数为 " + asyncNum );
    //async.mapLimit并发数控制，asyncNum是限制并发请求的数量
    async.mapLimit( photos, asyncNum, function(photo, callback ){
        request(photo)
            .then(function( result ) {
                var fileName = path.basename( photo );
                fs.writeFile( "./img/" + fileName, result.body, function( err ){
                    if( err ) {
                        console.log( err );
                    } else {
                        count ++;
                        // console.log( count + " done " );
                        callback( null, fileName );
                    }
                });
            })
            .then(function () {
                return;
            })
            .catch( function (error) {
                console.log( error );
            });
    },function( err, result ){
        if( err ) {
            console.log( err );
        } else {
            console.log( "下载完毕，请到img目录查看!" );
            // console.log( result );
        }
    })
}

//获取可用的代理IP
function getProxyIp(callback) {
    request.get('http://www.xicidaili.com/nn/1')
        .set('User-Agent', userAgent)
        .then(function (result) {
            var $ = cheerio.load(result.text);
            var trs = $("#ip_list tr");
            for(var i=1;i<trs.length;i++){
                var proxy = {};
                var tr = trs.eq(i);
                var tds = tr.children("td");
                proxy['ip'] = tds.eq(1).text();
                proxy['port'] = tds.eq(2).text();
                var speed = tds.eq(6).children("div").attr("title");
                speed = speed.substring(0, speed.length-1);
                var connectTime = tds.eq(7).children("div").attr("title");
                connectTime = connectTime.substring(0, connectTime.length-1);
                if(speed <= 5 && connectTime <= 1) {
                    //用速度和连接时间筛选一轮
                    proxyIps.push(proxy);
                }
            }
        })
        .then(function () {
            callback(proxyIps);
        })
        .catch( function (error) {
            console.log( error );
        });
}

// 转义后的编码转为Html
function escape2Html(str) {
    var arrEntities={'lt':'<','gt':'>','nbsp':' ','amp':'&','quot':'"'};
    return str.replace(/&(lt|gt|nbsp|amp|quot);/ig,function(all,t){return arrEntities[t];});
}

start();