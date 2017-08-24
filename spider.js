/**
 * 用superagent取代request,superagent支持异步ajax api,而且支持链接调用
 * 参考：http://visionmedia.github.io/superagent/
 */
var request = require("superagent");
var cheerio = require("cheerio");
var async = require("async");
var fs = require("fs");
var path = require("path");
require('superagent-proxy')(request);
require('superagent-charset')(request);
const FruitModel = require('./models').FruitModel;
const LinkModel = require('./models').LinkModel;

var userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.101 Safari/537.36';
var cookie = '_med=dw:1440&dh:900&pw:2880&ph:1800&ist:0; l=AoGB9AsZ9fssMykD1fA0P7EgEcabfvVG; tk_trace=1; _tb_token_=ee7beed0ba091; uc3=sg2=BqO0P6ftvnJ%2BXAcJaRtbFttBOdm%2B3%2BZLtudaSEx4xs4%3D&nk2=rp38peCN%2FQYlYJaRlQ%3D%3D&id2=UUjYHtYeBlm4&vt3=F8dBzWYYqhUrxdgoE%2FA%3D&lg2=VT5L2FSpMGV7TQ%3D%3D; uss=WqP3aC%2FcWf5klAilisf0Nfc1qDfD6w5zy74tvb46LEReYKdSfSYCIVVXsg%3D%3D; lgc=%5Cu7F51%5Cu5E97%5Cu4E13%5Cu5BB6_2009; tracknick=%5Cu7F51%5Cu5E97%5Cu4E13%5Cu5BB6_2009; cookie2=1c0868589c7dc9ef961667924ef09288; sg=994; cookie1=UR3Y1s7PiD4qvBKe9ciTQhHQRgMGLexIWBpnWGeuSHM%3D; unb=209994939; t=4ca3eec3d19693c040446c704a7a3856; _l_g_=Ug%3D%3D; _nk_=%5Cu7F51%5Cu5E97%5Cu4E13%5Cu5BB6_2009; cookie17=UUjYHtYeBlm4; uc1=cookie16=URm48syIJ1yk0MX2J7mAAEhTuw%3D%3D&cookie21=UtASsssmfaVh9vqYoVw%3D&cookie15=V32FPkk%2Fw0dUvg%3D%3D&existShop=true&pas=0&cookie14=UoTcDN5JLPPAoQ%3D%3D&tag=8&lng=zh_CN; login=true; pnm_cku822=144UW5TcyMNYQwiAiwZTXFIdUh1SHJOe0BuOG4%3D%7CUm5Ockp3SXBEfEdzRnJLdiA%3D%7CU2xMHDJ7G2AHYg8hAS8UKQcnCU4nTGI0Yg%3D%3D%7CVGhXd1llXWBeZ1NrUGRRZVxhVmtJfEd%2BRH1AdU53Q3dIfEh1SmQy%7CVWldfS0RMQ03DjERLRAwHjJTPRkmAHxBPw8hdyE%3D%7CVmhIGCcZOQA9HSEfKhAwCDAINBQoESgVNQE8ASEdJBkmBjMJM2Uz%7CV25Tbk5zU2xMcEl1VWtTaUlwJg%3D%3D; cna=s084EE7OfmACAXPso3JYwvHS; res=scroll%3A1387*5551-client%3A1387*288-offset%3A1387*5551-screen%3A1440*900; cq=ccp%3D0; isg=AvT0I6voEbqM9IX_wh7fd8Q6xbSmZRnRS8s93I5VgH8C-ZRDtt3oR6q7Dwfa';

var page = 1; //初始化页码
var maxPage = 100; //最大页码，超过停止抓取
var proxyIps = []; // 存储可用的代理地址
var proxyLinks = []; //存储准备抓取的列表页链接
var responseTime = 5000; //等待响应时间
var deadlineTime = 60000; //完成加载时间
var asyncNum = 10; //并发请求的数量

function start() {
    getProxyIp(function (ips) {
        var proxy = ips[Math.floor(Math.random()*ips.length)];
        getProxyLinks(page, proxy);
    });
}

/**
 * 抓取所有待爬取的链接
 */
function getProxyLinks(page, proxy) {
    request.get('http://gongying.99114.com/listing/%E6%B0%B4%E6%9E%9C_1_0_0_0_0_0_1-0-0-0-0_0_'+page+'.html')
        //设置请求头， User-Agent:随便找个浏览器copy一个过来
        .set('user-agent', userAgent)
        //设置字符编码
        // .charset('utf-8')
        //设置代理,国人代码不靠谱，先断掉
        // .proxy('http://'+proxy.ip+':'+proxy.port)
        // 天猫302，加上cookie可以解决，登录后从页面的头里面copy过来
        // .set('cookie', cookie)
        //超时控制
        .timeout({
            response: responseTime,
            deadline: deadlineTime
        })
        .end(function (err, res) {
            if(err){
                console.log(err);
            }else {
                if (page <= maxPage) {
                    var $ = cheerio.load(res.text);
                    var list = $('#J_itemlistCont');
                    var items = list.find('.item');
                    items.each(function () {
                        var link = $(this).find('.pic-link').attr('href');
                        LinkModel.create({
                            link: link
                        });
                        proxyLinks.push(link);
                    });
                    console.log("已为您成功抓取 " + proxyLinks.length + " 条链接>>>>>");
                    //开始抓取分页列表
                    setTimeout(function () {
                        page += 1;
                        getProxyLinks(page);
                    }, 300);
                } else {
                    console.log(proxyLinks);
                    console.log("已为您成功抓取 " + proxyLinks.length + " 条链接>>>");
                    //开始页面详情数据
                    getDetailData(asyncNum);
                }
            }
        });
}

/**
 * 抓取detail页面数据
 */
function getDetailData(asyncNum) {
    //async.mapLimit并发数控制，asyncNum是限制并发请求的数量
    proxyLinks = LinkModel.find().exec();
    async.mapLimit(proxyLinks, asyncNum, function(detail, callback ){
        var href = detail;
        request.get(detail)
            .set('user-agent', userAgent)
            .timeout({
                response: responseTime,
                deadline: deadlineTime
            })
            .end(function( err, res ) {
                if(err){
                    console.log(err);
                }else {
                    var $ = cheerio.load(res.text);
                    var detail = $('#bfb').find('.product_detail').eq(0);

                    var fruit = {};
                    fruit.proId = $('#productId').val();
                    fruit.proImg = detail.find('img').eq(0).attr('src');
                    fruit.proTitle = $('#product_Name').val();
                    fruit.beginNum = $('#number-price').find('.begin_number').text();
                    fruit.proPrice = $('#number-price').find('.price').text();
                    fruit.promotionPrice = parseInt($('#promotion_price').text() || 0, 10);
                    var contactUs = $('#bfa');
                    fruit.name = contactUs.find('.name').text();
                    fruit.address = contactUs.find('#detialAddr').text().replace(/\n|\t/g, '');
                    fruit.link = href;
                    console.log(fruit);
                    //这个callback要加上，否则不会执行后面的队列
                    callback();
                    //存储
                    var hasFruit = FruitModel.findOne({proId: fruit.proId}).exec() == null;
                    if (!hasFruit) {
                        FruitModel.create(fruit);
                    }
                }
            });
    },function( err, res ){
        if( err ) {
            console.log( err );
        } else {
            console.log( "数据抓取完毕！" );
        }
    })
}

//获取可用的代理IP
function getProxyIp(callback) {
    request.get('http://www.xicidaili.com/nn/1')
        .set('User-Agent', userAgent)
        .end(function (err, result) {
            if(err){
                console.log(err);
            }else {
                var $ = cheerio.load(result.text);
                var trs = $("#ip_list tr");
                for (var i = 1; i < trs.length; i++) {
                    var proxy = {};
                    var tr = trs.eq(i);
                    var tds = tr.children("td");
                    proxy['ip'] = tds.eq(1).text();
                    proxy['port'] = tds.eq(2).text();
                    var speed = tds.eq(6).children("div").attr("title");
                    speed = speed.substring(0, speed.length - 1);
                    var connectTime = tds.eq(7).children("div").attr("title");
                    connectTime = connectTime.substring(0, connectTime.length - 1);
                    if (speed <= 5 && connectTime <= 1) {
                        //用速度和连接时间筛选一轮
                        proxyIps.push(proxy);
                    }
                }
                callback(proxyIps);
            }
        });
}

// 转义后的编码转为Html
function escape2Html(str) {
    var arrEntities={'lt':'<','gt':'>','nbsp':' ','amp':'&','quot':'"'};
    return str.replace(/&(lt|gt|nbsp|amp|quot);/ig,function(all,t){return arrEntities[t];});
}

start();