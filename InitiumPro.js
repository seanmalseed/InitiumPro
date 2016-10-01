// ==UserScript==
// @name         InitiumPro
// @namespace    https://github.com/hey-nails/InitiumPro
// @version      0.4.1
// @updateURL    https://github.com/hey-nails/InitiumPro/blob/master/InitiumPro.js
// @downloadURL  https://github.com/hey-nails/InitiumPro/blob/master/InitiumPro.js
// @supportURL   https://github.com/hey-nails/InitiumPro
// @match        https://www.playinitium.com/*
// @match        http://www.playinitium.com/*
// @grant        none
// @grant        GM_setValue
// @grant        GM_info
// ==/UserScript==
/* jshint -W097 */

'use strict';

/*** INITIUM PRO OPTIONS ***/

var AUTOMATON = false;

var           AUTO_GOLD = true; //auto get gold after battles and when entering a room
var           AUTO_LOOT = true; //auto get items after battle
var           AUTO_REST = true; //auto rest if injured and in restable area
var           AUTO_CAMP = AUTOMATON; //auto create campsites in campable areas
var AUTO_CONFIRM_POPUPS = AUTOMATON; //clicks "ok" on confirm popups, like create a camp
var          AUTO_FIGHT = AUTOMATON; //repeats attack after your initial attack
var    AUTO_ATTACK_HAND = "right"; //auto attack with this hand. set to "" to turn off. auto fight must also be set to true
var   AUTO_LEAVE_FORGET = true; //automatically clicks 'Leave and Forget' after a battle
var           AUTO_FLEE = 70; //percent of health to flee automatically. 0 turns it off

/***************************/

var $ = window.jQuery;
var gotGold=false,localItems={},loc={},player={};
var urlParams=getUrlParams();

//flags
var FLAG_LOADSHOPS=false;
var FLAG_LOADSHOPITEMS=false;

updateCSS();
statDisplay();
getLocalGold();
getLocalStuff();

$(document).ready(function () {
    player=getPlayerStats();
    loc=getLocation();
    updateLayouts();
    putHotkeysOnMap();
    autoCombat();
});

//mutation observer watches the dom
MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
var myObserver = new MutationObserver (mutationHandler);
var obsConfig = { childList: true, characterData: true, attributes: true, subtree: true };

//these are the things to watch
$("#instanceRespawnWarning").each ( function () { myObserver.observe (this, obsConfig); } ); //watches instance timer
$(".popup_confirm_yes").each ( function () { myObserver.observe (this, obsConfig); } ); //watches for popup confirm boxes
$("#popups").each ( function () { myObserver.observe (this, obsConfig); } ); //watches for popup ok boxes
$("#page-popup-root").each ( function () { myObserver.observe (this, obsConfig); } ); //list overlay, like shops

//do stuff when dom changes!
function mutationHandler (mutationRecords) {
    mutationRecords.forEach ( function (mutation) {
        if (typeof mutation.removedNodes == "object") {
            var removed = $(mutation.removedNodes);
            var added = $(mutation.addedNodes);
            if(AUTO_CONFIRM_POPUPS) $(added).find(".popup_confirm_yes").click();//auto-click confirm yes button
            //instance countdown
            var countDown=removed.text().split("arrive")[1];
            if(countDown) {
                var tm=countDown.split(" ");
                if(tm[2]=="less")tm[2]="< 1";
                tm[2].replace("seconds.","sec").replace("minutes.","min");
                var header_location="<div class='header-location above-page-popup'><a href='index.jsp'>"+loc.name+":</a> <span style='color:red;'>"+tm[2]+" "+tm[3]+"</span></div>";
                $(".header-location").replaceWith(header_location);
            }
            //local merchants
            if($('.main-merchant-container').length===0 && added.html() && FLAG_LOADSHOPS===false) {
                loadLocalMerchantDetails();
            }
            //store item details
            if($('.saleItem').length===0 && added.html() && FLAG_LOADSHOPITEMS===false) {
                loadShopItemDetails();
            }
        }
    });
}

$(document).on('click', '.main-button-half', function(e) {
    //console.log(e.target); //gets button clicked
});

//add shop item stats to shop view
function loadShopItemDetails() {
    FLAG_LOADSHOPITEMS=true;
    var itemsLoaded = setInterval(function() {
        if ($('.saleItem').length) {
            var shopItems=$(".saleItem");
            for(var i=0;i<shopItems.length;i++) {
                var itemId=$(shopItems[i]).find(".clue").attr("rel").split("=")[1];
                var itemImg=$(shopItems[i]).find(".clue").find("img").attr("src");
                $(shopItems[i]).append("<div class='shop-item-stats table' id='shop-item-container"+itemId+"'>Loading item stats... <img src='/javascript/images/wait.gif'></div>");
                $.ajax({ url: "viewitemmini.jsp?itemId="+itemId, type: "GET",
                        itemId: itemId,
                        itemImg: itemImg,
                        success: function(data) {
                            var itemStatLines=$(data).find("div:not(#item-comparisons) .item-popup-field");
                            var itemStats={};
                            for(var t=0;t<itemStatLines.length && $(itemStatLines[t]).text().indexOf(":")!=-1;t++) {
                                var att=$(itemStatLines[t]).text().split(":");
                                if(att[1]) itemStats[formatItemStats(att[0])]=att[1].substring(1).replace(/(\r\n|\n|\r)/gm,"");
                            }
                            $("#shop-item-container"+this.itemId).html("<div class='row' id='shop-item-row-"+this.itemId+"'>"+
                                                                       "<div class='cell'><img style='float:left;width:45px;margin:10px 5px;' src='"+this.itemImg+"'></div>"+
                                                                       "<div class='cell shop-item-stats-inner' id='shop-item-"+this.itemId+"'></div>"+
                                                                       "<div class='cell shop-buy-button'>BUY</div>"+
                                                                       "</div>");
                            for(var i=0;i<Object.keys(itemStats).length;i++) {
                                var statName=Object.keys(itemStats)[i];
                                var statValue=itemStats[Object.keys(itemStats)[i]];
                                $("#shop-item-"+this.itemId).append("<div style='margin-left:10px;float:left;'><span style='color:orange;'>"+statName+":</span> <span style='color:white;'>"+statValue+"</span></div>");
                            }
                            return true;
                        }});
            }
            FLAG_LOADSHOPITEMS=false;
            clearInterval(itemsLoaded);
        }
    }, 1000);
}

//add list of carried products to shops overview
function loadLocalMerchantDetails() {
    FLAG_LOADSHOPS=true;
    var shopsLoaded = setInterval(function() {
        if ($('.main-merchant-container').length) {
            var localMerchants=$(".main-merchant-container");
            for(var i=0;i<localMerchants.length;i++) {
                var shopId=$(localMerchants[i]).find("a").attr("onclick").slice(10,-1);
                $(localMerchants[i]).append("<div class='merchant-inline-overview' id='store-overview-"+shopId+"'><div class='shop-overview'>Loading store overview... <img src='/javascript/images/wait.gif'></div></div>");
                $.ajax({ url: "/odp/ajax_viewstore.jsp?characterId="+shopId+"&ajax=true", type: "GET",
                        shopId: shopId,
                        success: function(data) {
                            var shopItemSummary="",items={},itemData=$(data).find(".clue");
                            for(var i=0;i<itemData.length;i++) { //get uniques
                                var itemName=$(itemData[i]).text(),itemPic=$(itemData[i]).find("img");
                                if(!items[itemName]) { items[itemName]=[{name:itemName,img:itemPic.attr("src")}]; }
                                else { items[itemName].push({name:itemName,img:itemPic.attr("src")});}
                            }
                            for(var item in items) { shopItemSummary+="<div class='shop-overview-item'><img src='"+items[item][0].img+"' width='18px'> ("+items[item].length+"x) <span style='color:#DDD;'>"+items[item][0].name+"</span></div>"; }
                            $("#store-overview-"+this.shopId+" .shop-overview").html("<hr>"+shopItemSummary);
                        }});
            }
            FLAG_LOADSHOPS=false;
            clearInterval(shopsLoaded);
        }
    }, 1000);
}

function loadVisibleItemStats() {
    var onScreenItems=$(".main-item-container");
}

function autoCombat() {
    //AUTO STUFF
    if(AUTO_FIGHT) {
        if(loc.type==="in combat!" && urlParams.type==="attack" && player.health>AUTO_FLEE) {
            if(urlParams.hand==="RightHand") { combatAttackWithRightHand(); }
            else { combatAttackWithLeftHand(); }
            $(".main-page:eq(1)").append("<div style='margin-top:-50px;'><span style='color:orange;'>[AUTO-FIGHT]</span>&nbsp;Attacking with "+urlParams.hand+"</div>");
        }
    }
    if(AUTO_ATTACK_HAND!=="" && AUTO_FIGHT) {
        if(loc.type==="in combat!"){
            switch(AUTO_ATTACK_HAND) {
                case "right":
                    combatAttackWithRightHand();
                    break;
                case "left":
                    combatAttackWithLeftHand();
                    break;
                default:
                    break;
            }
        }
    }
    if(AUTO_FLEE>0) {
        if(loc.type==="in combat!" && player.health<=AUTO_FLEE) {
            $(".main-page:eq(1)").append("<div style='margin-top:-20px;'><span style='color:orange;'>[AUTO-FLEE]</span>&nbsp;Your health is below "+AUTO_FLEE+"%, trying to gtfo!</div>");
            combatEscape();
        }
    }
    if(AUTO_REST) {
        if(loc.rest===true && player.health<100) {
            doRest();
        }
    }
    if(AUTO_LEAVE_FORGET) {
        if(loc.type==="combat site") {
            if(AUTO_GOLD) {
                setTimeout(function() {
                    if(gotGold===true) {
                        $('a[onclick^="leaveAndForgetCombatSite"]').click();
                    } else {
                        location.reload();//we didn't get gold, reload and try again.
                    }
                }, 7000); //reload aftera wait to make sure we got gold
            } else {
                $('a[onclick^="leaveAndForgetCombatSite"]').click();
            }
        }
    }
    if(AUTO_CAMP) {
        $("a[onclick^=forgetCombatSite]").click();//first things first - forget old camps and combat sites
        if(loc.campable===true && loc.type==="outside" && player.health>AUTO_FLEE){
            console.info("Auto-camping...");
            setTimeout(function() {createCampsite();},1000);
        }
        //low health, check for a camp every minute
        if(loc.campable===true && loc.type==="outside" && player.health<=AUTO_FLEE){
            showMessage("[AUTO-CAMP] Low health, looking for a campsite...");
            var firstCampsite=$("a[onclick^=doGoto]:contains('Camp:')")[0];
            if(firstCampsite)firstCampsite.click();
            setTimeout(function() {
                showMessage("[AUTO-CAMP] Didn't find a campsite, let's try to make one.");
                if(player.health>30)createCampsite();
            },1000);
        }
        if(loc.type==="camp" && player.health===100) { //auto leave camp if rested
            $("a[onclick^=doGoto]")[0].click();
        }
    }
}

/*
EXTRA HOTKEYS:
W for explore ignoring combat sites
C for create campsite
H for show hidden paths
*/
function keyListener(e) {
    if (e.srcElement.nodeName == 'INPUT') return;
    switch(e.key) {
        case "c":
            createCampsite();
            break;
        case "h":
            window.location.replace("/main.jsp?showHiddenPaths=true");
            break;
        default:
            break;
    }
}

//listen for keydown events
document.addEventListener('keydown', keyListener, false);

//get hotkeys from buttons and put 'em on the map overlay
function putHotkeysOnMap() {
    var i=0,keys={},otherExits={},mapOverlayDirs=[],
        directions=$('body').find('a[onclick^="doGoto"]');
    for(i=0;i<directions.length;i++) {
        var shortcut=$(directions[i]).find(".shortcut-key").text(),
            path=$(directions[i]).attr("onclick").split(",")[1].replace(")","");
        if(shortcut) { //get all the dirs
            keys[parseInt(path)]=shortcut;
            otherExits[parseInt(path)]="&nbsp;<a onclick='"+$(directions[i]).attr("onclick")+"'>"+directions[i].text.replace("(","<span style='color:white;'>(").replace(")",")</span> ").replace("Head towards ","").replace("Go to ","")+"</a>&nbsp;";
        } else {
            mapOverlayDirs.push({path:parseInt(path),dir:directions[i]});
        }
    }
    for(i=0;i<mapOverlayDirs.length;i++) { //update dirs on map overlay
        $(mapOverlayDirs[i].dir).text((keys[mapOverlayDirs[i].path]||"")+" "+$(mapOverlayDirs[i].dir).text());
        delete otherExits[mapOverlayDirs[i].path]; //exit is on overlay, delete from otherExits
    }
    if(!$.isEmptyObject(otherExits)){
        $(".main-banner").append("<div id='other-exits'>"+((mapOverlayDirs.length>0)?"Other exits:":"Exits:")+"</div>");
        for(var exit in otherExits) $("#other-exits").append(otherExits[exit]);
    }
}

function getLocalGold() {
    var localCharsURL="/locationcharacterlist.jsp";
    $.ajax({ url: localCharsURL, type: "GET",
            success: function(data) {
                var localItems = $(data).find('.main-item-controls a');
                var dogeCollected=0,foundDoge;
                var battleGoldLink=$(".main-item-container").find('a[onclick*="collectDogecoin"]');
                if(!localItems)return;
                localItems.each(function( index ) {
                    //console.log(localItems(index));
                    var onClick=$(this).attr("onclick");
                    if(onClick===undefined) return;
                    if(onClick.indexOf("collectDogecoin")>0) { //get gold
                        foundDoge=parseInt($( this ).text().split(" ")[1]);//add amount of gold
                        dogeCollected+=foundDoge;
                        if(foundDoge>0) {
                            $(this).click();
                            $(this).html("Collected "+ foundDoge+" gold!");
                            $(battleGoldLink).text("Collected "+ foundDoge+" gold!").css({"color":"yellow"});
                        }
                    }
                });
                gotGold=true;
                //inform the user of our sweet gains!
                if(dogeCollected>0) {
                    //var prevGold=parseInt($("#mainGoldIndicator").text().replace(/,/g, ""));
                    $("#mainGoldIndicator").text(Number(player.gold+dogeCollected).toLocaleString('en'));
                    pulse("#mainGoldIndicator","yellow");
                    showMessage("<img src='"+window.IMG_GOLDCOIN+"' class='coin-tiny'> Picked up "+dogeCollected+" gold!","yellow");
                }
            }
           });
}

function getLocalStuff() {
    var localItemsList,localItemsURL="/ajax_moveitems.jsp?preset=location";
    if($("#local-item-summary-container").length===0) $("#buttonbar-main").first().append("<div id='local-item-summary-container'><div id='local-item-summary-container'><h4 style='margin-top:20px;'>Items in area:&nbsp;<div id='reload-local-items-container'><a id='reload-inline-items'><img src='javascript/images/wait.gif'></a></div></h4><div class='blue-box-full-top'></div><div id='local-item-summary' class='div-table'><div><br/><br/><center><img src='javascript/images/wait.gif'></center><br/><br/></div></div><div class='blue-box-full-bottom'></div></div></div>"); //add summary box if not exists
    $("#reload-inline-items").html("<img src='javascript/images/wait.gif'>");
    localItems={};//clear the obj
    $.ajax({ url: localItemsURL, type: "GET",
            success: function(data) {
                var itemLines="",itemSubLines="",localItemSummary="",
                    locationName=$(data).find(".header-cell:nth-child(2) h5").text(),
                    localItemsList=$(data).find("#right a.clue"),
                    pickupLinks=$(data).find("#right a.move-right"),
                    items=localItemsList.map(function(index) {
                        var itemClass=$(localItemsList[index]).attr("class"),
                            rarity=itemClass.replace("clue","").replace("item-","").replace(" ",""),
                            viewLink=$(localItemsList[index]).attr("rel"),
                            item={id:viewLink.split("=")[1],
                                  name:$(localItemsList[index]).text(),
                                  image:$(localItemsList[index]).find("img").attr("src"),
                                  viewLink:viewLink,
                                  pickupLink:$(pickupLinks[index]).attr("onclick"),
                                  element:$(pickupLinks[index]),
                                  class:itemClass,
                                  rarity:(rarity==="")?rarity="common":rarity=rarity,
                                  stats:{},
                                  statLine:"",
                                  pickup:function(elem,remElem) {
                                      $(elem).html("<img src='/javascript/images/wait.gif'>");
                                      $.ajax({itemId:this.id,
                                              elem:elem, //element to update
                                              remElem:remElem, //element to remove on complete
                                              url: "/ServletCharacterControl?type=moveItem&itemId="+this.id+"&destinationKey=Character_"+window.characterId+"&v="+window.verifyCode+"&ajax=true&v="+window.verifyCode+"&_="+window.clientTime,
                                              success: function(data) {
                                                  removeElement($(this.remElem));
                                              }
                                             });
                                  }
                                 };
                        if(!localItems[item.name]) localItems[item.name]={}; //create item
                        localItems[item.name][item.id]=item;
                        return item;
                    });

                //item overview list (one row per item type)
                for(var item in localItems) {//summary row for display on under main-dynamic-content-box
                    var firstItem=localItems[item][Object.keys(localItems[item])[0]]; //first item in obj
                    localItemSummary+=
                        "<div class='row'>"+
                        "<div class='cell localitem-summary-image'><img src='"+firstItem.image+ "'></div>"+
                        "<div class='cell localitem-summary-count'>(x "+Object.keys(localItems[item]).length+") &nbsp;<img src='"+window.IMG_ARROW+"' style='width:11px;'>&nbsp;</div>"+
                        "<div class='cell localitem-summary-name show-item-sublist'><div class='main-item-name'><a onclick=''>"+firstItem.name+"</a></div></div>"+
                        "<div class='cell localitem-summary-view show-item-sublist' item-name='"+firstItem.name+"'><a onclick=''>(View all)</a></div>"+
                        "<div class='cell localitem-summary-take' item-name='"+firstItem.name+"'><a onclick=''>(Take all)</a></div>"+
                        "</div>";
                }
                //display items in area summary when user enters
                $("#local-item-summary").html(localItemSummary);
                $("#local-item-summary").css({"background-size":"100% "+((Object.keys(localItems).length*28)+100)+"px"});
                $("#reload-inline-items").bind('click',function(){getLocalStuff();});
                $('.show-item-sublist').bind('click',function(){ //bind the actions
                    var itemName=$(this).attr('item-name'),firstItem=localItems[itemName][Object.keys(localItems[itemName])[0]], //first item in obj
                        itemSublist="<div style='font-size:20px;'><img src='"+firstItem.image+ "'> <span style='color:#DDD;'>x"+Object.keys(localItems[firstItem.name]).length+"</span> <span>"+firstItem.name+":</span><span style='float:right;font-size:27px;'><a class='close-item-sublist' onclick=''>X</a></span></div><hr>";
                    $(".itemSublist").remove();//remove all other item sublists
                    for(var item in localItems[firstItem.name]) { //item sublist popup
                        var itemData,subItem=localItems[firstItem.name][item];
                        itemSublist+="<div class='row'>"+
                            "<div class='cell "+subItem.class+" localitem-popup-image'><img src='"+subItem.image+ "'>&nbsp;</div>"+
                            "<div class='cell'><a class='"+subItem.class+" localitem-popup-name' rel='"+subItem.viewLink+"'>"+subItem.name+"</a><br/>"+
                            "<div class='inline-stats' id='inline-stats-"+item+"'>Loading item stats...<br/><img src='/javascript/images/wait.gif'></div></div>"+
                            "<div class='cell localitem-summary-view' style='vertical-align:middle;'>&nbsp;<a class='take-item' itemName='"+encodeURIComponent(subItem.name)+"' itemId='"+item+"'>(Take)</a></div>"+
                            "</div>";
                    }
                    var itemSublistPopup='<div class="itemSublist table cluetip ui-widget ui-widget-content ui-cluetip clue-right-rounded cluetip-rounded ui-corner-all" style="position: absolute; margin-bottom:20px; width: 450px; left: '+($(this).position().left)+'px; z-index: 2000000; top: '+($(this).position().top+5)+'px; box-shadow: rgba(0, 0, 0, 0.498039) 1px 1px 6px;"><div class="cluetip-outer" style="position: relative; z-index: 2000000; overflow: visible; height: auto;"><div class="cluetip-inner ui-widget-content ui-cluetip-content">'+itemSublist+'</div></div><div class="cluetip-extra"></div><div class="cluetip-arrows ui-state-default" style="z-index: 2000001; top: -4px; display: block;"></div></div>';
                    $("body").append(itemSublistPopup);
                    $('.close-item-sublist').bind('click',function(){ $(".itemSublist").remove(); }); //close item sublist button closes all item sublists
                    $('.take-item').bind('click',function(){
                        var lol=localItems[decodeURIComponent($(this).attr("itemName"))][$(this).attr("itemId")].pickup(this,$(this).parent().parent());
                    });
                    for(var itemId in localItems[firstItem.name]) ajaxItemStats(firstItem.name,itemId); //load stats in popup
                });
                $('.localitem-summary-take').bind('click',function(){ //take all
                    var objCount=0;
                    for(var item in localItems[$(this).attr('item-name')]) {
                        objCount++;
                        if(objCount===Object.keys(localItems[$(this).attr('item-name')]).length) { localItems[$(this).attr('item-name')][item].pickup(this,$(this).parent()); }
                        else { localItems[$(this).attr('item-name')][item].pickup(this); }
                    }
                });
                $("#reload-inline-items").html("↻");
            }
           });
}

function ajaxItemStats(itemName,itemId) {
    $.ajax({itemName:itemName,
            itemId:itemId,
            url: localItems[itemName][itemId].viewLink, type: "GET",
            success: function(data) {
                var itemStatLines=$(data).find("div:not(#item-comparisons) .item-popup-field");
                for(var t=0;t<itemStatLines.length && $(itemStatLines[t]).text().indexOf(":")!=-1;t++) {
                    var att=$(itemStatLines[t]).text().split(":");
                    if(att[1]) localItems[this.itemName][this.itemId].stats[formatItemStats(att[0])]=att[1].substring(1).replace(/(\r\n|\n|\r)/gm,"");//localItems[itemName][itemId].stats[att[0].replace(" - ","")]=att[1];localItems[itemName][itemId].stats.id=itemId;
                }
                var itemStats=localItems[this.itemName][this.itemId].stats;
                $("#inline-stats-"+this.itemId).html("<div class='inline-stats' id='inline-stats-"+this.itemId+"'></div>");
                for(var i=0;i<Object.keys(itemStats).length;i++) {
                    var statName=Object.keys(localItems[this.itemName][this.itemId].stats)[i];
                    var statValue=localItems[this.itemName][this.itemId].stats[statName];
                    $("#inline-stats-"+this.itemId).append("<div style='margin-left:10px;float:left;'><span style='color:orange;'>"+statName+":</span> <span style='color:white;'>"+statValue+"</span></div>");
                }
                return true;
            },
            error: function(e) {
                return false;
            }
           });
    return null;
}
function formatItemStats(thang) {
    return thang.replace(" - ","")
        .replace("Dexterity penalty","Dex")
        .replace("Strength requirement","Str")
        .replace("Weapon damage","Dmg")
        .replace("Critical chance","Crit")
        .replace("Critical hit multiplier","Crit mult")
        .replace("Damage Type","Dmg type")
        .replace("Block chance","Blk")
        .replace("Damage reduction","Dmg red")
        .replace("Block bludgeoning","Blk bldg")
        .replace("Block piercing","Blk prc")
        .replace("Block slashing","Blk slsh")
        .replace("Weight","Wt")
        .replace("Space","Spc")
        .replace("Durability","Dur");
}
//get location data
function getLocation() {
    var loc={name:$(".header-location").text()};
    //get type of location
    if(loc.name.indexOf("Combat site:")!==-1) { loc.type=($(".character-display-box").length>1)?"in combat!":"combat site"; } //if we're in a combat site, are we in combat or not? 
    else if(loc.name.indexOf("Camp:")!==-1) { loc.type="camp"; } //if we ain't fighting, are are we in a camp?
    else { loc.type="outside"; } //if all else fails, i guess we're outside
    loc.campable=($("a[onclick^=createCampsite]").length>0)?true:false;
    loc.rest=($("a[onclick^=doRest]").length>0)?true:false;
    return loc;
}

//get player stats and details
function getPlayerStats() {
    var hp=$("#hitpointsBar").text().split("/");
    return { charachterId:window.characterId,
            verifyCode:window.verifyCode = "$2a$04$S3euOFE17Mb9pa4SVdhB6O8t6PQrb/vNNsfff/NJ9cjG.075pfNdq",
            name:$("a[rel^=#profile]:eq(0)").text(),
            maxhp:parseInt(hp[1]),
            hp:parseInt(hp[0]),
            health:+((hp[0]/hp[1])*100).toFixed(2),
            gold:parseInt($("#mainGoldIndicator").text().replace(/,/g, ""))};
}

//display stats
function statDisplay() {
    $.ajax({
        url: $(".character-display-box:eq(0)").children().first().attr("rel"),
        type: "GET",
        success: function(data) {
            var stats = $(data).find('.main-item-subnote');
            $(".character-display-box:eq(0) > div:eq(1)").append("<div id='pro-stats' class='buff-pane'>"+
                                                                 "<img src='"+window.IMG_STAT_SWORD+"'><span>"+$( stats[0] ).text().split(" ")[0]+"</span>"+//str
                                                                 "<img src='"+window.IMG_STAT_SHIELD+"'><span>"+$( stats[1] ).text().split(" ")[0]+"</span>"+//def
                                                                 "<img src='"+window.IMG_STAT_POTION+"'><span>"+$( stats[2] ).text().split(" ")[0]+"</span>"+//int
                                                                 "</a></div>");
            $('.header-stats a:nth-child(2)').children().html("Inv<span style=\"color:#AAA;margin-left:4px;margin-right:-5px;\">("+$( stats[3] ).text().split(" ")[0]+")</span> ");//carry

        }
    });
}
//utility stuff
function updateLayouts() {
    //Class updates
    $(".main-buttonbox").find("br").remove().appendTo("main-page-banner-image");
    $(".main-button").removeClass("main-button").addClass("main-button-half").addClass("action-button");
    //Add loc type to header
    if(loc.type)$(".header-location").append("<span style='margin-left:12px;color:red;'>("+loc.type+")</span>");
    //show 'em that pro is active!
    $(".header").append("<div id='initium-pro-version' style='position:absolute;top:262px;margin-left:630px;z-index:99999999;'><a href='https://github.com/hey-nails/InitiumPro' target='_blank'><img style='width:38%;' src='"+window.IMG_PRO+"'><span style='font-size:9px;margin-left:-21px;padding-top:5px;'>v "+GM_info.script.version+"</span></a></div>");
}
function updateCSS() {
    $("head").append("<style>"+
                     //style overrides
                     ".main-page p { margin-top:70px; }"+
                     "#instanceRespawnWarning {display:none!important;}"+
                     ".character-display-box { padding: 5px!important; }"+
                     ".main-buttonbox { text-align: center; }"+
                     ".main-button-icon { display: none; }"+
                     ".main-button-half.action-button { width: 33.3333%;float: left;font-size:15px; }"+
                     ".main-dynamic-content-box { padding-left:10px; }"+
                     "#instanceRespawnWarning { padding:10px; }"+
                     "#banner-loading-icon { opacity: 0.7; }"+
                     ".saleItem { margin-top:10px; }"+
                     ".saleItem .clue { margin-left:20px; }"+
                     ".saleItem .clue img { display:none; }"+
                     //InitiumPro custom elements
                     ".merchant-inline-overview { padding:5px 0px 10px 5px; }"+
                     ".main-merchant-container .main-item { margin-top:25px; }"+
                     ".shop-overview { color:#999;margin-bottom:20px; }"+
                     ".shop-overview-item { float:left;font-size:13px;width:300px; }"+
                     "#other-exits { position:absolute;top:185px;left:15px;text-shadow:1px 1px 3px rgba(0, 0, 0, 1); }"+
                     ".inline-stats {font-size:11px;padding:0px 0px 5px 2px;width:300px; }"+
                     ".coin-tiny { width:12px; }"+
                     ".table { display:table; } .row { display:table-row; } .cell { display:table-cell; }"+
                     "#local-item-summary { margin: 0px 0px 0px 10px;background:url(/images/ui/large-popup-middle.jpg);background-position-y:-50px;overflow:hidden; }"+
                     ".blue-box-full-top { margin: 15px 0px 0px 10px;height:10px;background:url(/images/ui/large-popup-top.jpg);background-position-y:-5px; }"+
                     ".blue-box-full-bottom { margin: 0px 0px 20px 10px;height:10px;background:url(/images/ui/large-popup-bottom.jpg); background-position-y:-5px; }"+
                     ".localitem-summary-image { padding:0px 13px 0px 3px;vertical-align:middle; } .localitem-summary-image image { height:30px;width:30px; }"+
                     ".localitem-summary-count { color:#DDD;padding-right:10px;text-align:right;vertical-align:middle; }"+
                     ".localitem-summary-name { padding-right:15px;color:#FFF;vertical-align:middle; }"+
                     ".localitem-summary-rarity { padding-left:15px;color:gray;vertical-align:middle; }"+
                     ".main-item-name { }"+
                     ".localitem-summary-view { padding-right:13px;vertical-align:middle; } .localitem-summary-view a { color:#e69500; }"+
                     ".localitem-summary-take { vertical-align:middle; } .localitem-summary-take a { color:#666666; }"+
                     "#reload-local-items-container { height:25px;float:right;padding-right:5px; }"+
                     ".localitem-popup-name { }"+
                     ".shop-item-stats { border: 1px solid #404040; height: 70px; padding: 12px; margin: 0px 0px 0px 0px;width: 700px;border-radius: 10px; background:rgba(0,0,0,.2); }"+
                     ".shop-item-stats-inner { vertical-align:middle; }"+
                     ".shop-buy-button {  width:100px;vertical-align:middle;text-align:center;border:1px solid rgba(255,255,255,0.2);border-radius:10px;background:rgba(255,255,255,0.1);}"+
                     ".shop-buy-button:hover { background:rgba(255,255,255,0.2); }"+
                     //stat box icons
                     ".str-icon, .def-icon, .int-icon { color: yellow } "+
                     "#pro-stats { width:160px; height:17px; font-size:10.5px; text-align:left; margin:-1px 0px 0px -5px; font-family:sans-serif; text-shadow:1px 1px 2px rgba(0, 0, 0, 1); } #pro-stats img { width:9px;height:9px;margin:3px 3px 0px 3px;vertical-align:sub; border:1px solid #AAAAAA;background:rgba(0,0,0,.5);border-radius:4px;padding:2px;/*-webkit-filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.2));filter: drop-shadow(1px 1px 1px rgba(0, 0, 0, 0.2));*/} #pro-stats span { padding:0px 4px 0px 0px; }"+
                     "</style>");
    //base64 images
    window.IMG_PRO="data:image/gif;base64,R0lGODlhYgBDAJEDALyxngAAAP+ZAP///yH5BAEAAAMALAAAAABiAEMAAAL/nI+py+0Po5y0ghCq3pyDn3XiSBoXWKaq9J3hCsdmcNGvjJOum/fizvMJKcDg8OgoGpFMBBCzbDJPLYztIpVSQdZo1retCaC27zGMEYyvNzPuGVCvve5VlSufl+syeL67x2cHgicH1YIlqOJnSONCo5hyJ9ZICBVZwqh26AiJOTKZVknl+dmBFjd6Z/rjWLjpWgPAehorCot4Quthm4qLWLpL1PsXqytsQTzaOYs8DOw7R9qM2fbcGc1JyIqxoSnNTBtn/RCazXwit5AnoKCekMcQ75BKzvA9Rpg+f8CuhsAOoD+BAxFYuWUvwTdt+/gN8Peu4EOI/SD+O3AwW7kr/5R+MbNY0SLIiQENiHxn4CC7hOZWQgOgrmREigFj2rxoUuIAK/7I4es1C2c8lCRn6mznMCTRW38UcmSaDxg1gkmLtstZlWSDkhgtvlhoLBhVnGOVksV6dR3XnSIzgM0ltqw8lGuVOlgbrefTc3CnuiP6VyhgtGnVLs2ImBNfqQ+y2kVr+GzgwjsTWxbFMO7ku3QHW20M2NdlzF2mRXAMOTU81Kq7Wl6DWJ/myJwLZ9UZmIFolbBLh5OA2qFj3I8XpMkIy/e2CcMBN6+L9cHo2MeYe9a6+jpFghF4NhqjZ/bWk9jHSiZ8kXWC4+xjUzhJ3Op59NDpjbvQ++B7+MHVj4mcwFOAiI0BXFrCzRfSafXZB14jAxJYgXopIKjbONMhFOF1ddRj4WhNWUfhFxxagdGIeSW0WTX3rbFeh3lBCIGGTUxnXIcQoZggHy/qV+EmXsVImRkuwiKddzeCpsh9YuCYElQrOZNSVMcBeCGULo6zQUZQGpQci1mSuGWTxYgAZpiV8Ugmk58UAAA7";
    window.IMG_GOLDCOIN="data:image/gif;base64,R0lGODlhDgAQAPIAAAAAAJRjAMaUAP/OAP///wAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJDAAFACH+FlJlc2l6ZWQgd2l0aCBlemdpZi5jb20ALAAAAAAOABAAAANEWFrQvsuRKUSLYI69K1AZp3VfQ2znEHRWiA7CSrrDGXNtWsMybIo83O91m+lsvZYrUJF5GLpA8sOg4SwYwPUCqTqoigQAIfkECQwABQAsAAAAAA4AEAAAAzdYqtCwkBEyxIsF0MEt1gMRVNcChiMJnWJXZlurmnHq0Zx8S7n9sr5VzRUBBUY7HGdWnDA/jkgCACH5BAUMAAEALAAAAAAOABAAAAIpjA9wuzCjWBsiygCpu9jVwWVf6G2XaEooeJas6pLay6xcUN64puPWUQAAIfkEBQwABQAsAgAAAAoAEAAAAy1YCqsOgxTBViRk0Ibzhh02AWA4lt15pRQqtutLxhIc1gzTaRXKP5Gfo9BzJAAAOw==";
    window.IMG_STAT_SWORD="data:image/gif;base64,R0lGODlhEAAQAKIHAO2dBJmpsMPN0Uxjb/vJYuSvT2h9hv///yH5BAEAAAcALAAAAAAQABAAAAM2eLrMAC2qByUh80lFQNebUlChIhiGV57GMBYbOwhHgUUyHQboXPKtwK8n3BFXx+GgWELpSocEADs=";
    window.IMG_STAT_SHIELD="data:image/gif;base64,R0lGODlhEAAQAKIEAJmZmf+NAP+fAP+PAP///wAAAAAAAAAAACH5BAEAAAQALAAAAAAQABAAAANDSLrQsNA5MWRTQOgdwtgPkW3aYJpBOJLnqZJlm2Iw1VY0fAuv3vKYVQx1yW1OnlCQNUgql6VOESIaOamRTOWJrU4XCQA7";
    window.IMG_STAT_POTION="data:image/gif;base64,R0lGODlhEAAQAKIFALvEyAOW3Sq49imd1GN6hf///wAAAAAAACH5BAEAAAUALAAAAAAQABAAAAM6WKpATmDJ1V6csrqL2YOdIgwkGQwdKaxB22LDyroBLAt0PcVybve038wlxAV3Nx8SSFwOX7vSQFlIAAA7";
    window.IMG_ARROW="data:image/gif;base64,R0lGODlhFAASAIABAPv+/v///yH5BAEAAAEALAAAAAAUABIAAAInjH+ggO2x1JtRTlfZbXnz6iEdlJXmiaYlqYLh6MGbfNGU+0ZhsjwFADs=";
}
function removeElement(el) {$(el).fadeOut(300, function() { $(this).remove(); });}
function showMessage(msg,color) { $(".main-dynamic-content-box").first().append("<div style=\"color:"+(color||"white")+";padding-top:15px;\">"+msg+"</div>");}
function pulse(elName,color) { $(elName).css({"background-color":color}).fadeTo(400, 0.5, function() { $(elName).fadeTo(300, 1).css({"background-color":""}); }); }
function getUrlParams() { var params={};window.location.search.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(str,key,value) { params[key] = value; });return params;}
