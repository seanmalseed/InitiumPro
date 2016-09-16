// ==UserScript==
// @name         InitiumPro
// @namespace    https://github.com/hey-nails/InitiumPro
// @version      0.0.2
// @updateURL    https://github.com/hey-nails/InitiumPro/blob/master/InitiumPro.js
// @downloadURL    https://github.com/hey-nails/InitiumPro/blob/master/InitiumPro.js
// @supportURL      https://github.com/hey-nails/InitiumPro
// @match        https://www.playinitium.com/*
// @match        http://www.playinitium.com/*
// @grant        none
// @grant        GM_setValue
// ==/UserScript==
/* jshint -W097 */

'use strict';

var $ = window.jQuery;
var localStuff={};

$(document).ready(function () {

    setStyles();
    statDisplay();
    doAuto();
    pulse("#mainGoldIndicator");

    //do auto stuff after 2 seconds!
    /*setTimeout(function() {

        //what type of location are we in?
        var loc = {title:$(".header-location").text()};
        if (loc.title.indexOf("Combat site:") >= 0) loc.type="combat";

        //if(loc.type!=="combat") autoExplore();
        if(loc.type=="combat") collectGold();

    }, 1000);*/

});

function autoExplore() {
    var explore = document.evaluate('//a[contains(@onclick, "doExplore(true)")]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if(explore) {
        //$(explore).click();
        showMessage("Auto-exploring!");
    }
}

/*
EXTRA HOTKEYS:
W for explore ignoring combat sites
G for get gold
*/
function keyListener(e) {
    if (e.srcElement.nodeName == 'INPUT') return;
    switch(e.key) {
        case "y":
            showMessage("Auto-wander ON!");
            //GM_setValue("autowander", true);
            //autoExplore();
            break;
        case "g":
            getLocalStuff();
            break;
        default:
            return;
    }
}

//listen for keydown events
document.addEventListener('keydown', keyListener, false);

// AUTO GOLD, AUTO LOOT, ETC
function doAuto() {
    getLocalStuff();
}

function getLocalStuff() {
    var localItems;
    var localCharsURL="https://www.playinitium.com/locationcharacterlist.jsp",
        localItemsURL="https://www.playinitium.com/ajax_moveitems.jsp?preset=location";

    $.ajax({ url: localCharsURL, type: "GET",
            success: function(data) {
                var findGold = $(data).find('.main-item-controls a');
                getGold(findGold);
            }
           });
    $.ajax({ url: localItemsURL, type: "GET",
            success: function(data) {
                var itemLines="",itemSubLines="",localItemSummary="",
                    flatItems={};

                var locationName = $(data).find(".header-cell:nth-child(2) h5").text();
                var localItems = $(data).find("#right a.clue");
                var pickupLinks = $(data).find("#right a.move-right");

                var items=localItems.map(function(index) {
                    var item = {id:index,
                                name:$(localItems[index]).text(),
                                link:$(localItems[index]).attr("rel"),
                                image:$(localItems[index]).find("img").attr("src"),
                                pickupLink:$(pickupLinks[index]).attr("onclick"),
                               };
                    if(!flatItems[item.name]) {
                        flatItems[item.name]=[item];
                    } else {
                        flatItems[item.name].push(item);
                    }

                    /*itemLines+="<div><a onclick='"+ item.pickupLink +"' class='move-left'>(Pick up)</a>"+
                        "<div class='main-item'>"+
                        "<span class=''><a class='clue' rel='"+item.link+"'><div class='main-item-image-backing'><img src='"+item.image+"' border=0/></div><div class='main-item-name'>"+item.name+"</div></a></span>"+
                        "<div class='main-item-controls'></div></div></div>";*/

                    return item;
                });
                //build sub item lists and user display overview box
                for(var item in flatItems) {
                    //summary row for display on under main-dynamic-content-box
                    localItemSummary+=
                        "<div style='display:table-row;'>"+
                        "<div style='display:table-cell;padding-right:13px;vertical-align:middle;'><img src='"+flatItems[item][0].image+ "' style='height:30px;width:30px;'></div>"+
                        "<div style='display:table-cell;color:#DDD;padding-right:10px;text-align:right;vertical-align:middle;'>(x "+flatItems[item].length+") &nbsp;<i class='fa fa-arrow-right'></i>&nbsp;</div>"+
                        "<div style='display:table-cell;padding-right:15px;color:#FFF;vertical-align:middle;'><div class='main-item-name'>"+flatItems[item][0].name+"</div></div>"+
                        "<div style='display:table-cell;padding-right:13px;vertical-align:middle;'><a href='#' style='color:#e69500;'>(View all)</a></div>"+
                        "<div style='display:table-cell;vertical-align:middle;'><a href='#' style='color:#666666;'>(Take all)</a></div>"+
                        "</div>";

                    //local items popup box item summary
                    itemLines+=
                        "<div class='main-item' style='display:table-row;'>"+
                        "<div style='display:table-cell;'> <a onclick='"+ flatItems[item][0].pickupLink +"' class='move-left'>(Take all)</a></div>"+
                        "<div class='main-item-image-backing' style='padding-right:15px;display:table-cell;'><img src='"+flatItems[item][0].image+"' border=0/></div>"+
                        "<div class='main-item-name' style='font-size:20px;display:table-cell;'>"+flatItems[item][0].name+"</div>"+
                        "<div class='main-item-controls' style='display:table-cell;padding-left:10px;'><a id='toggle-subitems'>(x "+ flatItems[item].length +")</a></div>"+
                        "</div>";

                    //local items popup box sub-items
                    itemSubLines="";
                    for(var i=0;i<flatItems[item].length;i++) {
                        itemSubLines+="<div id='subitems-"+i+"' style='display:table-row'>"+
                            "<div style='display:table-cell;'></div>"+
                            "<div style='display:table-cell;'><a onclick='"+ flatItems[item][i].pickupLink +"' class='move-left'>(Take)</a> </div>"+
                            "<div style='display:table-cell;padding-right:10px;'> "+flatItems[item][i].name+"&nbsp;</div>"+
                            "<div style='display:table-cell;'>Stats</div>"+
                            "</div>";
                    }
                    itemLines+=itemSubLines;
                }
                //display items in area summary when user enters
                $("#buttonbar-main").first().append("<h4 style='margin-top:20px;'>Items in area:</h4>"+
                                                    "<div id='local-item-summary' style='margin-left:10px;margin-bottom:25px;background:url(/images/banner-backing.jpg);background-size: 100% 100%;'>"+
                                                    "<div style='display:table;'>"+
                                                    localItemSummary+
                                                    "</div></div>");

                var boxContent="<center><h4>"+locationName+"</h4></center>"+
                    "<br><div style='display:table;'>"+itemLines+"</div>";

                //console.log(flatItems);
                //showPopup("Items Around You ("+items.length +")",boxContent);

                //sortNearbyItems(localItems);
            }
           });
}
function toggleSubItems() {
    $( "#subitems-0" ).toggle();
    console.log("Clicked yo");
}
function sortNearbyItems(localItems) {
    //var item={name: localItems[10].find(."main-item-name")};

    //console.log(item.name);
}

function getGold(localItems) {
    var dogeCollected=0,foundDoge;
    if(!localItems)return;
    localItems.each(function( index ) {
        var onClick=$( this ).attr("onclick");
        if(onClick===undefined) return;
        if(onClick.indexOf("collectDogecoin")>0) { //get gold
            foundDoge=parseInt($( this ).text().split(" ")[1]);//add amount of gold
            dogeCollected+=foundDoge;
            showMessage("Found "+ foundDoge+" on a thing!<br/> -"+onClick);
            console.log(this);
            $(this).click();
        }
    });
    //inform the user of our sweet gains!
    if(dogeCollected>0) {
        var prevGold=parseInt($("#mainGoldIndicator").text().replace(/,/g, ""));
        $("#mainGoldIndicator").text(Number(prevGold+dogeCollected).toLocaleString('en'));
        pulse("#mainGoldIndicator");
        showMessage("Picked up "+dogeCollected+" gold!","yellow");
    }
}

//display stats
function statDisplay() {
    var charDiv = $('.character-display-box').first();
    var headerInventory = $('.header-stats a:nth-child(2)');
    var href = $( '.character-display-box').children().first().attr( "rel" );

    $.ajax({
        url: href,
        type: "GET",

        success: function(data) {
            var stats = $(data).find('.main-item-subnote');
            charDiv.append("<div id=\"pro-stats\"><div class=\"statline\">"+
                           "<i class='str-icon fa fa-hand-rock-o'></i> "+$( stats[0] ).text().split(" ")[0]+" "+//str
                           "<i class='def-icon fa fa-shield'></i> "+$( stats[1] ).text().split(" ")[0]+" "+//def
                           "<i class='int-icon fa fa-flask'></i> "+$( stats[2] ).text().split(" ")[0]+" "+//int
                           "</div></div>");
            headerInventory.children().html("Inv<span style=\"color:#AAA;margin-left:4px;margin-right:-5px;\">("+$( stats[3] ).text().split(" ")[0]+")</span> ");//carry
            //.children().text("Inv");

            $(".str-icon").css({"color":"yellow"});
            $(".def-icon").css({"color":"yellow"});
            $(".int-icon").css({"color":"yellow"});
            $("#pro-stats").css({"background-image":"url('/images/main-button-backing-half.jpg')",
                                 "background-size":"contain",
                                 "background-repeat":"no-repeat",
                                 "width":"160px",
                                 "height":"100px",
                                 "text-align":"center",
                                 "padding-top":"5px",
                                 "margin":"5px 5px",
                                 "font-size":"11px",
                                 "-moz-border-radius":"3px",
                                 "-webkit-border-radius":"3px",
                                 "border-radius":"3px"});

        }
    });
}

//utility stuff
function setStyles() {
    //Font Awesome because pretty
    $("<link/>", {
        rel: "stylesheet",
        type: "text/css",
        href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.6.3/css/font-awesome.css"
    }).appendTo("head");

    //Style and text updates
    $(".main-buttonbox")
        .css({"text-align":"center"})
        .find("br").remove()
        .appendTo("main-page-banner-image");
    $(".main-button")
        .removeClass("main-button")
        .addClass("main-button-half")
        .css({"width":"33.3333%",
              "float":"left",
              "font-size":"15px"});
    $(".main-button-icon").css({"display":"none"});
}
function showPopup(title,content) {
    closePagePopup();currentPopupStackIndex++;exitFullscreenChat();

    var pagePopupId = "page-popup" + currentPopupStackIndex;
    var structure = "<div id='"+pagePopupId+"'><div id='" +
        pagePopupId+"-content' style='min-height:150px;' " +
        "class='page-popup'><img id='banner-loading-icon' " +
        "src='javascript/images/wait.gif' border=0/></div>" +
        "<div class='page-popup-glass'></div><a class='page-popup-X' " +
        "onclick='closePagePopup()'>X</a></div>";

    // checks if current page is doesn't have #page-popup-root
    //  and adds the needed div if it is
    if ($("#page-popup-root").length == 0) {
        $('<div id="page-popup-root"></div>').insertAfter(".chat_box");
    }

    //Create popup
    $("#page-popup-root").append(structure);

    //If chat box doesnt have z index, remove glass box
    if( $(".chat_box").css('z-index') != '1000100') {
        $(".page-popup-glass").remove();
    }

    //Fill popup with content
    $("#"+pagePopupId+"-content").html("<center><h1>"+title+"</h1></center>"+
                                       content);
    //set up collapsable items
    $(".toggle-subitems").click(toggleSubItems());

    // pressing escape will close the popup
    if (currentPopupStackIndex === 1) {
        $(document).bind("keydown",function(e) {
            if ((e.keyCode == 27)) {
                closePagePopup();
            }
        });
    }

    // hides previous popup if there was one
    if (currentPopupStackIndex > 1) {
        $("#page-popup" + (currentPopupStackIndex-1)).hide();
    }
}
function showMessage(msg,color) { $(".main-dynamic-content-box").first().append("<div style=\"color:"+(color||"white")+";padding-top:15px;\">"+msg+"</div>");}
function pulse(elName) { $(elName).fadeTo(400, 0.8, function() { $(elName).fadeTo(300, 1); }); }
