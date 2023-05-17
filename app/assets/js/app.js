var MauticVars = {};
var mQuery = jQuery.noConflict(true);
window.jQuery = mQuery;
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
        position = position || 0;
        return this.substr(position, searchString.length) === searchString;
    };
}
MauticVars.activeRequests = 0;
mQuery.ajaxSetup({
    beforeSend: function(request, settings) {
        if (settings.showLoadingBar) {
            Mautic.startPageLoadingBar();
        }
        if (typeof IdleTimer != 'undefined') {
            var userLastActive = IdleTimer.getLastActive();
            var queryGlue = (settings.url.indexOf("?") == -1) ? '?' : '&';
            settings.url = settings.url + queryGlue + 'mauticUserLastActive=' + userLastActive;
        }
        if (mQuery('#mauticLastNotificationId').length) {
            var queryGlue = (settings.url.indexOf("?") == -1) ? '?' : '&';
            settings.url = settings.url + queryGlue + 'mauticLastNotificationId=' + mQuery('#mauticLastNotificationId').val();
        }
        if (settings.type == 'POST') {
            request.setRequestHeader('X-CSRF-Token', mauticAjaxCsrf);
        }
        return true;
    },
    cache: false
});
mQuery(document).ajaxComplete(function(event, xhr, settings) {
    Mautic.stopPageLoadingBar();
    xhr.always(function(response) {
        if (response.flashes) Mautic.setFlashes(response.flashes);
    });
});
mQuery(document).ajaxStop(function(event) {
    MauticVars.activeRequests = 0;
    Mautic.stopPageLoadingBar();
});
mQuery(document).ready(function() {
    if (typeof mauticContent !== 'undefined') {
        mQuery("html").Core({
            console: false
        });
    }
    mQuery(document).on('keydown', function(e) {
        if (e.which === 8 && !mQuery(e.target).is("input:not([readonly]):not([type=radio]):not([type=checkbox]), textarea, [contentEditable], [contentEditable=true]")) {
            e.preventDefault();
        }
    });
});
MauticVars.manualStateChange = true;
if (typeof History != 'undefined') {
    History.Adapter.bind(window, 'statechange', function() {
        if (MauticVars.manualStateChange == true) {
            window.location.reload();
        }
        MauticVars.manualStateChange = true;
    });
}
MauticVars.iconClasses = {};
MauticVars.routeInProgress = '';
MauticVars.moderatedIntervals = {};
MauticVars.intervalsInProgress = {};
var Mautic = {
    loadedContent: {},
    keyboardShortcutHtml: {},
    addKeyboardShortcut: function(sequence, description, func, section) {
        Mousetrap.bind(sequence, func);
        var sectionName = section || 'global';
        if (!Mautic.keyboardShortcutHtml.hasOwnProperty(sectionName)) {
            Mautic.keyboardShortcutHtml[sectionName] = {};
        }
        Mautic.keyboardShortcutHtml[sectionName][sequence] = '<div class="col-xs-6"><mark>' + sequence + '</mark>: ' + description + '</div>';
    },
    bindGlobalKeyboardShortcuts: function() {
        Mautic.addKeyboardShortcut('shift+d', 'Load the Dashboard', function(e) {
            mQuery('#mautic_dashboard_index').click();
        });
        Mautic.addKeyboardShortcut('shift+c', 'Load Contacts', function(e) {
            mQuery('#mautic_contact_index').click();
        });
        Mautic.addKeyboardShortcut('shift+right', 'Activate Right Menu', function(e) {
            mQuery(".navbar-right a[data-toggle='sidebar']").click();
        });
        Mautic.addKeyboardShortcut('shift+n', 'Show Notifications', function(e) {
            mQuery('.dropdown-notification').click();
        });
        Mautic.addKeyboardShortcut('shift+s', 'Global Search', function(e) {
            mQuery('#globalSearchContainer .search-button').click();
        });
        Mautic.addKeyboardShortcut('mod+z', 'Undo change', function(e) {
            if (mQuery('.btn-undo').length) {
                mQuery('.btn-undo').click();
            }
        });
        Mautic.addKeyboardShortcut('mod+shift+z', 'Redo change', function(e) {
            if (mQuery('.btn-redo').length) {
                mQuery('.btn-redo').click();
            }
        });
        Mousetrap.bind('?', function(e) {
            var modalWindow = mQuery('#MauticSharedModal');
            modalWindow.find('.modal-title').html('Keyboard Shortcuts');
            modalWindow.find('.modal-body').html(function() {
                var modalHtml = '';
                var sections = Object.keys(Mautic.keyboardShortcutHtml);
                sections.forEach(function(section) {
                    var sectionTitle = (section + '').replace(/^([a-z\u00E0-\u00FC])|\s+([a-z\u00E0-\u00FC])/g, function($1) {
                        return $1.toUpperCase();
                    });
                    modalHtml += '<h4>' + sectionTitle + '</h4><br />';
                    modalHtml += '<div class="row">';
                    var sequences = Object.keys(Mautic.keyboardShortcutHtml[section]);
                    sequences.forEach(function(sequence) {
                        modalHtml += Mautic.keyboardShortcutHtml[section][sequence];
                    });
                    modalHtml += '</div><hr />';
                });
                return modalHtml;
            });
            modalWindow.find('.modal-footer').html('<p>Press <mark>shift+?</mark> at any time to view this help modal.');
            modalWindow.modal();
        });
    },
    translate: function(id, params) {
        if (!mauticLang.hasOwnProperty(id)) {
            return id;
        }
        var translated = mauticLang[id];
        if (params) {
            for (var key in params) {
                if (!params.hasOwnProperty(key)) continue;
                var regEx = new RegExp('%' + key + '%', 'g');
                translated = translated.replace(regEx, params[key])
            }
        }
        return translated;
    },
    setupBrowserNotifier: function() {
        notify.requestPermission();
        notify.config({
            autoClose: 10000
        });
        Mautic.browserNotifier = {
            isSupported: notify.isSupported,
            permissionLevel: notify.permissionLevel()
        };
        Mautic.browserNotifier.isSupported = notify.isSupported;
        Mautic.browserNotifier.permissionLevel = notify.permissionLevel();
        Mautic.browserNotifier.createNotification = function(title, options) {
            return notify.createNotification(title, options);
        }
    },
    stopPageLoadingBar: function() {
        if (MauticVars.activeRequests < 1) {
            MauticVars.activeRequests = 0;
        } else {
            MauticVars.activeRequests--;
        }
        if (MauticVars.loadingBarTimeout) {
            clearTimeout(MauticVars.loadingBarTimeout);
        }
        if (MauticVars.activeRequests == 0) {
            mQuery('.loading-bar').removeClass('active');
        }
    },
    startPageLoadingBar: function() {
        mQuery('.loading-bar').addClass('active');
        MauticVars.activeRequests++;
    },
    startCanvasLoadingBar: function() {
        mQuery('.canvas-loading-bar').addClass('active');
    },
    startModalLoadingBar: function(modalTarget) {
        mQuery(modalTarget + ' .modal-loading-bar').addClass('active');
    },
    stopCanvasLoadingBar: function() {
        mQuery('.canvas-loading-bar').removeClass('active');
    },
    stopModalLoadingBar: function(modalTarget) {
        mQuery(modalTarget + ' .modal-loading-bar').removeClass('active');
    },
    activateButtonLoadingIndicator: function(button) {
        button.prop('disabled', true);
        if (!button.find('.fa-spinner.fa-spin').length) {
            button.append(mQuery('<i class="fa fa-fw fa-spinner fa-spin"></i>'));
        }
    },
    removeButtonLoadingIndicator: function(button) {
        button.prop('disabled', false);
        button.find('.fa-spinner').remove();
    },
    activateLabelLoadingIndicator: function(el) {
        var labelSpinner = mQuery("label[for='" + el + "']");
        Mautic.labelSpinner = mQuery('<i class="fa fa-fw fa-spinner fa-spin"></i>');
        labelSpinner.append(Mautic.labelSpinner);
    },
    removeLabelLoadingIndicator: function() {
        mQuery(Mautic.labelSpinner).remove();
    },
    loadNewWindow: function(options) {
        if (options.windowUrl) {
            Mautic.startModalLoadingBar();
            var popupName = 'mauticpopup';
            if (options.popupName) {
                popupName = options.popupName;
            }
            setTimeout(function() {
                var opener = window.open(options.windowUrl, popupName, 'height=600,width=1100');
                if (!opener || opener.closed || typeof opener.closed == 'undefined') {
                    alert(mauticLang.popupBlockerMessage);
                } else {
                    opener.onload = function() {
                        Mautic.stopModalLoadingBar();
                        Mautic.stopIconSpinPostEvent();
                    };
                }
            }, 100);
        }
    },
    loadScript: function(url, onLoadCallback, alreadyLoadedCallback) {
        if (typeof Mautic.headLoadedAssets == 'undefined') {
            Mautic.headLoadedAssets = {};
        } else if (typeof Mautic.headLoadedAssets[url] != 'undefined') {
            if (alreadyLoadedCallback && typeof Mautic[alreadyLoadedCallback] == 'function') {
                Mautic[alreadyLoadedCallback]();
            }
            return;
        }
        Mautic.headLoadedAssets[url] = 1;
        mQuery.getScript(url, function(data, textStatus, jqxhr) {
            if (textStatus == 'success') {
                if (onLoadCallback && typeof Mautic[onLoadCallback] == 'function') {
                    Mautic[onLoadCallback]();
                } else if (typeof Mautic[mauticContent + "OnLoad"] == 'function') {
                    if (typeof Mautic.loadedContent[mauticContent] == 'undefined') {
                        Mautic.loadedContent[mauticContent] = true;
                        Mautic[mauticContent + "OnLoad"]('#app-content', {});
                    }
                }
            }
        });
    },
    loadStylesheet: function(url) {
        if (typeof Mautic.headLoadedAssets == 'undefined') {
            Mautic.headLoadedAssets = {};
        } else if (typeof Mautic.headLoadedAssets[url] != 'undefined') {
            return;
        }
        Mautic.headLoadedAssets[url] = 1;
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = url;
        mQuery('head').append(link);
    },
    startIconSpinOnEvent: function(target) {
        if (MauticVars.ignoreIconSpin) {
            MauticVars.ignoreIconSpin = false;
            return;
        }
        if (typeof target == 'object' && typeof(target.target) !== 'undefined') {
            target = target.target;
        }
        if (mQuery(target).length) {
            var hasBtn = mQuery(target).hasClass('btn');
            var hasIcon = mQuery(target).hasClass('fa');
            var dontspin = mQuery(target).hasClass('btn-nospin');
            var i = (hasBtn && mQuery(target).find('i.fa').length) ? mQuery(target).find('i.fa') : target;
            if (!dontspin && ((hasBtn && mQuery(target).find('i.fa').length) || hasIcon)) {
                var el = (hasIcon) ? target : mQuery(target).find('i.fa').first();
                var identifierClass = (new Date).getTime();
                MauticVars.iconClasses[identifierClass] = mQuery(el).attr('class');
                var specialClasses = ['fa-fw', 'fa-lg', 'fa-2x', 'fa-3x', 'fa-4x', 'fa-5x', 'fa-li', 'text-white', 'text-muted'];
                var appendClasses = "";
                for (var i = 0; i < specialClasses.length; i++) {
                    if (mQuery(el).hasClass(specialClasses[i])) {
                        appendClasses += " " + specialClasses[i];
                    }
                }
                mQuery(el).removeClass();
                mQuery(el).addClass('fa fa-spinner fa-spin ' + identifierClass + appendClasses);
            }
        }
    },
    stopIconSpinPostEvent: function(specificId) {
        if (typeof specificId != 'undefined' && specificId in MauticVars.iconClasses) {
            mQuery('.' + specificId).removeClass('fa fa-spinner fa-spin ' + specificId).addClass(MauticVars.iconClasses[specificId]);
            delete MauticVars.iconClasses[specificId];
        } else {
            mQuery.each(MauticVars.iconClasses, function(index, value) {
                mQuery('.' + index).removeClass('fa fa-spinner fa-spin ' + index).addClass(value);
            });
            MauticVars.iconClasses = {};
        }
    },
    redirectWithBackdrop: function(url) {
        Mautic.activateBackdrop();
        setTimeout(function() {
            window.location = url;
        }, 50);
    },
    activateBackdrop: function(hideWait) {
        if (!mQuery('#mautic-backdrop').length) {
            var container = mQuery('<div />', {
                id: 'mautic-backdrop'
            });
            mQuery('<div />', {
                'class': 'modal-backdrop fade in'
            }).appendTo(container);
            if (typeof hideWait == 'undefined') {
                mQuery('<div />', {
                    "class": 'mautic-pleasewait'
                }).html(mauticLang.pleaseWait).appendTo(container);
            }
            container.appendTo('body');
        }
    },
    deactivateBackgroup: function() {
        if (mQuery('#mautic-backdrop').length) {
            mQuery('#mautic-backdrop').remove();
        }
    },
    executeAction: function(action, callback) {
        if (typeof Mautic.activeActions == 'undefined') {
            Mautic.activeActions = {};
        } else if (typeof Mautic.activeActions[action] != 'undefined') {
            return;
        }
        Mautic.activeActions[action] = true;
        Mautic.dismissConfirmation();
        if (action.indexOf('batchExport') >= 0) {
            Mautic.initiateFileDownload(action);
            return;
        }
        mQuery.ajax({
            showLoadingBar: true,
            url: action,
            type: "POST",
            dataType: "json",
            success: function(response) {
                Mautic.processPageContent(response);
                if (typeof callback == 'function') {
                    callback(response);
                }
            },
            error: function(request, textStatus, errorThrown) {
                Mautic.processAjaxError(request, textStatus, errorThrown);
            },
            complete: function() {
                delete Mautic.activeActions[action]
            }
        });
    },
    processAjaxError: function(request, textStatus, errorThrown, mainContent) {
        if (textStatus == 'abort') {
            Mautic.stopPageLoadingBar();
            Mautic.stopCanvasLoadingBar();
            Mautic.stopIconSpinPostEvent();
            return;
        }
        var inDevMode = typeof mauticEnv !== 'undefined' && mauticEnv == 'dev';
        if (inDevMode) {
            console.log(request);
        }
        if (typeof request.responseJSON !== 'undefined') {
            response = request.responseJSON;
        } else if (typeof(request.responseText) !== 'undefined') {
            var errorStart = request.responseText.indexOf('{"newContent');
            var jsonString = request.responseText.slice(errorStart);
            if (jsonString) {
                try {
                    var response = JSON.parse(jsonString);
                    if (inDevMode) {
                        console.log(response);
                    }
                } catch (err) {
                    if (inDevMode) {
                        console.log(err);
                    }
                }
            } else {
                response = {};
            }
        }
        if (response) {
            if (response.newContent && mainContent) {
                mQuery('#app-content .content-body').html(response.newContent);
                if (response.route && response.route.indexOf("ajax") == -1) {
                    MauticVars.manualStateChange = false;
                    History.pushState(null, "Mautic", response.route);
                }
            } else if (response.newContent && mQuery('.modal.in').length) {
                mQuery('.modal.in .modal-body-content').html(response.newContent);
                mQuery('.modal.in .modal-body-content').removeClass('hide');
                if (mQuery('.modal.in  .loading-placeholder').length) {
                    mQuery('.modal.in  .loading-placeholder').addClass('hide');
                }
            } else if (inDevMode) {
                console.log(response);
                if (response.errors && response.errors[0] && response.errors[0].message) {
                    alert(response.errors[0].message);
                }
            }
        }
        Mautic.stopPageLoadingBar();
        Mautic.stopCanvasLoadingBar();
        Mautic.stopIconSpinPostEvent();
    },
    setModeratedInterval: function(key, callback, timeout, params) {
        if (typeof MauticVars.intervalsInProgress[key] != 'undefined') {
            clearTimeout(MauticVars.moderatedIntervals[key]);
        } else {
            MauticVars.intervalsInProgress[key] = true;
            if (typeof params == 'undefined') {
                params = [];
            }
            if (typeof callback == 'function') {
                callback(params);
            } else {
                window["Mautic"][callback].apply('window', params);
            }
        }
        MauticVars.moderatedIntervals[key] = setTimeout(function() {
            Mautic.setModeratedInterval(key, callback, timeout, params)
        }, timeout);
    },
    moderatedIntervalCallbackIsComplete: function(key) {
        delete MauticVars.intervalsInProgress[key];
    },
    clearModeratedInterval: function(key) {
        Mautic.moderatedIntervalCallbackIsComplete(key);
        clearTimeout(MauticVars.moderatedIntervals[key]);
        delete MauticVars.moderatedIntervals[key];
    },
    setFlashes: function(flashes) {
        mQuery('#flashes').append(flashes);
        mQuery('#flashes .alert-new').each(function() {
            var me = this;
            window.setTimeout(function() {
                mQuery(me).fadeTo(500, 0).slideUp(500, function() {
                    mQuery(this).remove();
                });
            }, 4000);
            mQuery(this).removeClass('alert-new');
        });
    },
    setBrowserNotifications: function(notifications) {
        mQuery.each(notifications, function(key, notification) {
            Mautic.browserNotifier.createNotification(notification.title, {
                body: notification.message,
                icon: notification.icon
            });
        });
    },
    setNotifications: function(notifications) {
        if (notifications.lastId) {
            mQuery('#mauticLastNotificationId').val(notifications.lastId);
        }
        if (mQuery('#notifications .mautic-update')) {
            mQuery('#notifications .mautic-update').remove();
        }
        if (notifications.hasNewNotifications) {
            if (mQuery('#newNotificationIndicator').hasClass('hide')) {
                mQuery('#newNotificationIndicator').removeClass('hide');
            }
        }
        if (notifications.content) {
            mQuery('#notifications').prepend(notifications.content);
            if (!mQuery('#notificationMautibot').hasClass('hide')) {
                mQuery('#notificationMautibot').addClass('hide');
            }
        }
        if (notifications.sound) {
            mQuery('.playSound').remove();
            mQuery.playSound(notifications.sound);
        }
    },
    showNotifications: function() {
        mQuery("#notificationsDropdown").off('hide.bs.dropdown');
        mQuery('#notificationsDropdown').on('hidden.bs.dropdown', function() {
            if (!mQuery('#newNotificationIndicator').hasClass('hide')) {
                mQuery('#notifications .is-unread').remove();
                mQuery('#newNotificationIndicator').addClass('hide');
            }
        });
    },
    clearNotification: function(id) {
        if (id) {
            mQuery("#notification" + id).fadeTo("fast", 0.01).slideUp("fast", function() {
                mQuery(this).find("*[data-toggle='tooltip']").tooltip('destroy');
                mQuery(this).remove();
                if (!mQuery('#notifications .notification').length) {
                    if (mQuery('#notificationMautibot').hasClass('hide')) {
                        mQuery('#notificationMautibot').removeClass('hide');
                    }
                }
            });
        } else {
            mQuery("#notifications .notification").fadeOut(300, function() {
                mQuery(this).remove();
                if (mQuery('#notificationMautibot').hasClass('hide')) {
                    mQuery('#notificationMautibot').removeClass('hide');
                }
            });
        }
        mQuery.ajax({
            url: mauticAjaxUrl,
            type: "GET",
            data: "action=clearNotification&id=" + id
        });
    },
    ajaxActionRequest: function(action, data, successClosure, showLoadingBar, queue) {
        if (typeof Mautic.ajaxActionXhrQueue == 'undefined') {
            Mautic.ajaxActionXhrQueue = {};
        }
        if (typeof Mautic.ajaxActionXhr == 'undefined') {
            Mautic.ajaxActionXhr = {};
        } else if (typeof Mautic.ajaxActionXhr[action] != 'undefined') {
            if (queue) {
                if (typeof Mautic.ajaxActionXhrQueue[action] == 'undefined') {
                    Mautic.ajaxActionXhrQueue[action] = [];
                }
                Mautic.ajaxActionXhrQueue[action].push({
                    action: action,
                    data: data,
                    successClosure: successClosure,
                    showLoadingBar: showLoadingBar
                });
                return;
            } else {
                Mautic.removeLabelLoadingIndicator();
                Mautic.ajaxActionXhr[action].abort();
            }
        }
        if (typeof showLoadingBar == 'undefined') {
            showLoadingBar = false;
        }
        Mautic.ajaxActionXhr[action] = mQuery.ajax({
            url: mauticAjaxUrl + '?action=' + action,
            type: 'POST',
            data: data,
            showLoadingBar: showLoadingBar,
            success: function(response) {
                if (typeof successClosure == 'function') {
                    successClosure(response);
                }
            },
            error: function(request, textStatus, errorThrown) {
                Mautic.processAjaxError(request, textStatus, errorThrown, true);
            },
            complete: function() {
                delete Mautic.ajaxActionXhr[action];
                if (typeof Mautic.ajaxActionXhrQueue[action] !== 'undefined' && Mautic.ajaxActionXhrQueue[action].length) {
                    var next = Mautic.ajaxActionXhrQueue[action].shift();
                    Mautic.ajaxActionRequest(next.action, next.data, next.successClosure, next.showLoadingBar, false);
                }
            }
        });
    },
    isLocalStorageSupported: function() {
        try {
            localStorage.setItem('mautic.test', 'mautic');
            localStorage.removeItem('mautic.test');
            return true;
        } catch (e) {
            return false;
        }
    }
};;
Mautic.loadContent = function(route, link, method, target, showPageLoading, callback, data) {
    if (typeof Mautic.loadContentXhr == 'undefined') {
        Mautic.loadContentXhr = {};
    } else if (typeof Mautic.loadContentXhr[target] != 'undefined') {
        Mautic.loadContentXhr[target].abort();
    }
    showPageLoading = (typeof showPageLoading == 'undefined' || showPageLoading) ? true : false;
    Mautic.loadContentXhr[target] = mQuery.ajax({
        showLoadingBar: showPageLoading,
        url: route,
        type: method,
        dataType: "json",
        data: data,
        success: function(response) {
            if (response) {
                response.stopPageLoading = showPageLoading;
                if (response.callback) {
                    window["Mautic"][response.callback].apply('window', [response]);
                    return;
                }
                if (response.redirect) {
                    Mautic.redirectWithBackdrop(response.redirect);
                } else if (target || response.target) {
                    if (target) response.target = target;
                    Mautic.processPageContent(response);
                } else {
                    MauticVars.liveCache = new Array();
                    MauticVars.lastSearchStr = '';
                    if (typeof response.route === 'undefined') {
                        response.route = route;
                    }
                    if (typeof response.activeLink === 'undefined' && link) {
                        response.activeLink = link;
                    }
                    Mautic.processPageContent(response);
                }
                Mautic.stopIconSpinPostEvent();
            }
            MauticVars.routeInProgress = '';
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown, true);
            MauticVars.routeInProgress = '';
            Mautic.stopIconSpinPostEvent();
            Mautic.stopPageLoadingBar();
        },
        complete: function() {
            if (typeof callback !== 'undefined') {
                if (typeof callback == 'function') {
                    callback();
                } else {
                    window["Mautic"][callback].apply('window', []);
                }
            }
            Mautic.generatePageTitle(route);
            delete Mautic.loadContentXhr[target];
        }
    });
    return false;
};
Mautic.loadAjaxColumn = function(elementName, route, callback) {
    var className = '.' + elementName;
    if (mQuery(className).length) {
        var ids = [];
        mQuery(className).each(function() {
            if (!mQuery(this).text()) {
                var id = mQuery(this).attr('data-value');
                ids.push(id);
            }
        });
        var batchIds;
        if (ids.length == 0) {
            Mautic.getCallback(callback);
        }
        while (ids.length > 0) {
            batchIds = ids.splice(0, 10);
            Mautic.ajaxActionRequest(route, {
                ids: batchIds,
                entityId: Mautic.getEntityId()
            }, function(response) {
                if (response.success && response.stats) {
                    for (var i = 0; i < response.stats.length; i++) {
                        var stat = response.stats[i];
                        if (mQuery('#' + elementName + '-' + stat.id).length) {
                            mQuery('#' + elementName + '-' + stat.id).html(stat.data);
                        }
                    }
                    if (batchIds.length < 10) {
                        Mautic.getCallback(callback);
                    }
                }
            }, false, true);
        }
    }
}
Mautic.sortTableByColumn = function(tableId, sortElement, removeZero) {
    var tbody = mQuery(tableId).find('tbody');
    tbody.find('tr').each(function() {
        if (parseInt(mQuery(this).find(sortElement).text()) == 0) {
            mQuery(this).remove();
        }
    })
    tbody.find('tr').sort(function(a, b) {
        var tda = parseFloat(mQuery(a).find(sortElement).text());
        var tdb = parseFloat(mQuery(b).find(sortElement).text());
        return tda < tdb ? 1 : tda > tdb ? -1 : 0;
    }).appendTo(tbody);
}
Mautic.getCallback = function(callback) {
    if (callback && typeof callback !== 'undefined') {
        if (typeof callback == 'function') {
            callback();
        } else {
            window["Mautic"][callback].apply('window', []);
        }
    }
}
Mautic.generatePageTitle = function(route) {
    if (-1 !== route.indexOf('timeline')) {
        return
    } else if (-1 !== route.indexOf('view')) {
        var currentModule = route.split('/')[3];
        var titleWithHTML = mQuery('.page-header h3').find('span.span-block');
        var currentModuleItem = '';
        if (1 < titleWithHTML.length) {
            currentModuleItem = titleWithHTML.eq(0).text() + ' - ' + titleWithHTML.eq(1).text();
        } else {
            currentModuleItem = mQuery('.page-header h3').text();
        }
        currentModuleItem = mQuery('<div>' + currentModuleItem + '</div>').text();
        mQuery('title').html(currentModule[0].toUpperCase() + currentModule.slice(1) + ' | ' + currentModuleItem + ' | Mautic');
    } else {
        mQuery('title').html(mQuery('.page-header h3').html() + ' | Mautic');
    }
};
Mautic.processPageContent = function(response) {
    if (response) {
        Mautic.deactivateBackgroup();
        if (response.errors && 'dev' == mauticEnv) {
            alert(response.errors[0].message);
            console.log(response.errors);
        }
        if (!response.target) {
            response.target = '#app-content';
        }
        Mautic.onPageUnload(response.target, response);
        if (response.newContent) {
            if (response.replaceContent && response.replaceContent == 'true') {
                mQuery(response.target).replaceWith(response.newContent);
            } else {
                mQuery(response.target).html(response.newContent);
            }
        }
        if (response.notifications) {
            Mautic.setNotifications(response.notifications);
        }
        if (response.browserNotifications) {
            Mautic.setBrowserNotifications(response.browserNotifications);
        }
        if (response.route) {
            MauticVars.manualStateChange = false;
            History.pushState(null, "Mautic", response.route);
            Mautic.generatePageTitle(response.route);
        }
        if (response.target == '#app-content') {
            if (response.mauticContent) {
                mauticContent = response.mauticContent;
            }
            if (response.activeLink) {
                var link = response.activeLink;
                if (link !== undefined && link.charAt(0) != '#') {
                    link = "#" + link;
                }
                var parent = mQuery(link).parent();
                mQuery(".nav-sidebar").find(".active").removeClass("active");
                parent.addClass("active");
                var openParent = parent.closest('li.open');
                mQuery(".nav-sidebar").find(".open").each(function() {
                    if (!openParent.hasClass('open') || (openParent.hasClass('open') && openParent[0] !== mQuery(this)[0])) {
                        mQuery(this).removeClass('open');
                    }
                });
            }
            mQuery('body').animate({
                scrollTop: 0
            }, 0);
        } else {
            var overflow = mQuery(response.target).css('overflow');
            var overflowY = mQuery(response.target).css('overflowY');
            if (overflow == 'auto' || overflow == 'scroll' || overflowY == 'auto' || overflowY == 'scroll') {
                mQuery(response.target).animate({
                    scrollTop: 0
                }, 0);
            }
        }
        if (response.overlayEnabled) {
            mQuery(response.overlayTarget + ' .content-overlay').remove();
        }
        Mautic.onPageLoad(response.target, response);
    }
};
Mautic.onPageLoad = function(container, response, inModal) {
    Mautic.initDateRangePicker(container + ' #daterange_date_from', container + ' #daterange_date_to');
    Mautic.makeLinksAlive(mQuery(container + " a[data-toggle='ajax']"));
    mQuery(container + " form[data-toggle='ajax']").each(function(index) {
        Mautic.ajaxifyForm(mQuery(this).attr('name'));
    });
    Mautic.makeModalsAlive(mQuery(container + " *[data-toggle='ajaxmodal']"))
    Mautic.activateModalEmbeddedForms(container);
    mQuery(container + " *[data-toggle='livesearch']").each(function(index) {
        Mautic.activateLiveSearch(mQuery(this), "lastSearchStr", "liveCache");
    });
    mQuery(container + " *[data-toggle='listfilter']").each(function(index) {
        Mautic.activateListFilterSelect(mQuery(this));
    });
    var pageTooltips = mQuery(container + " *[data-toggle='tooltip']");
    pageTooltips.tooltip({
        html: true,
        container: 'body'
    });
    pageTooltips.each(function(i) {
        var thisTooltip = mQuery(pageTooltips.get(i));
        var elementParent = thisTooltip.parent();
        if (elementParent.get(0).tagName === 'LABEL') {
            elementParent.append('<i class="fa fa-question-circle"></i>');
            elementParent.hover(function() {
                thisTooltip.tooltip('show')
            }, function() {
                thisTooltip.tooltip('hide');
            });
        }
    });
    mQuery(container + " *[data-toggle='sortablelist']").each(function(index) {
        Mautic.activateSortable(this);
    });
    mQuery(container + " div.sortable-panels").each(function() {
        Mautic.activateSortablePanels(this);
    });
    mQuery(container + " a[data-toggle='download']").off('click.download');
    mQuery(container + " a[data-toggle='download']").on('click.download', function(event) {
        event.preventDefault();
        Mautic.initiateFileDownload(mQuery(this).attr('href'));
    });
    Mautic.makeConfirmationsAlive(mQuery(container + " a[data-toggle='confirmation']"));
    mQuery(container + " *[data-toggle='datetime']").each(function() {
        Mautic.activateDateTimeInputs(this, 'datetime');
    });
    mQuery(container + " *[data-toggle='date']").each(function() {
        Mautic.activateDateTimeInputs(this, 'date');
    });
    mQuery(container + " *[data-toggle='time']").each(function() {
        Mautic.activateDateTimeInputs(this, 'time');
    });
    mQuery(container + " *[data-onload-callback]").each(function() {
        var callback = function(el) {
            if (typeof window["Mautic"][mQuery(el).attr('data-onload-callback')] == 'function') {
                window["Mautic"][mQuery(el).attr('data-onload-callback')].apply('window', [el]);
            }
        }
        mQuery(document).ready(callback(this));
    });
    mQuery(container + " input[data-toggle='color']").each(function() {
        Mautic.activateColorPicker(this);
    });
    mQuery(container + " select").not('.multiselect, .not-chosen').each(function() {
        Mautic.activateChosenSelect(this);
    });
    mQuery(container + " select.multiselect").each(function() {
        Mautic.activateMultiSelect(this);
    });
    Mautic.activateLookupTypeahead(mQuery(container));
    mQuery(container + " .table-responsive").on('shown.bs.dropdown', function(e) {
        var table = mQuery(this),
            menu = mQuery(e.target).find(".dropdown-menu"),
            tableOffsetHeight = table.offset().top + table.height(),
            menuOffsetHeight = menu.offset().top + menu.outerHeight(true);
        if (menuOffsetHeight > tableOffsetHeight)
            table.css("padding-bottom", menuOffsetHeight - tableOffsetHeight + 16)
    });
    mQuery(container + " .table-responsive").on("hide.bs.dropdown", function() {
        mQuery(this).css("padding-bottom", 0);
    })
    mQuery(container + " .nav-tabs[data-toggle='tab-hash']").each(function() {
        var hash = document.location.hash;
        var prefix = 'tab-';
        if (hash) {
            var hashPieces = hash.split('?');
            hash = hashPieces[0].replace("#", "#" + prefix);
            var activeTab = mQuery(this).find('a[href=' + hash + ']').first();
            if (mQuery(activeTab).length) {
                mQuery('.nav-tabs li').removeClass('active');
                mQuery('.tab-pane').removeClass('in active');
                mQuery(activeTab).parent().addClass('active');
                mQuery(hash).addClass('in active');
            }
        }
        mQuery(this).find('a').on('shown.bs.tab', function(e) {
            window.location.hash = e.target.hash.replace("#" + prefix, "#");
        });
    });
    mQuery(container + " .nav-overflow-tabs ul").each(function() {
        Mautic.activateOverflowTabs(this);
    });
    mQuery(container + " .nav.sortable").each(function() {
        Mautic.activateSortableTabs(this);
    });
    Mautic.activateTabDeleteButtons(container);
    mQuery(container + ' .btn:not(.btn-nospin)').on('click.spinningicons', function(event) {
        Mautic.startIconSpinOnEvent(event);
    });
    mQuery(container + ' input[class=list-checkbox]').on('change', function() {
        var disabled = Mautic.batchActionPrecheck(container) ? false : true;
        var color = (disabled) ? 'btn-default' : 'btn-info';
        var button = container + ' th.col-actions .input-group-btn button';
        mQuery(button).prop('disabled', disabled);
        mQuery(button).removeClass('btn-default btn-info').addClass(color);
    });
    mQuery(container + " .bottom-form-buttons").each(function() {
        if (inModal || mQuery(this).closest('.modal').length) {
            var modal = (inModal) ? container : mQuery(this).closest('.modal');
            if (mQuery(modal).find('.modal-form-buttons').length) {
                mQuery(modal).find('.bottom-form-buttons').addClass('hide');
                var buttons = mQuery(modal).find('.bottom-form-buttons').html();
                mQuery(modal).find('.modal-form-buttons').html('');
                mQuery(buttons).filter("button").each(function(i, v) {
                    var id = mQuery(this).attr('id');
                    var button = mQuery("<button type='button' />").addClass(mQuery(this).attr('class')).addClass('btn-copy').html(mQuery(this).html()).appendTo(mQuery(modal).find('.modal-form-buttons')).on('click.ajaxform', function(event) {
                        if (mQuery(this).hasClass('disabled')) {
                            return false;
                        }
                        if (!mQuery(this).hasClass('btn-dnd')) {
                            mQuery(this).parent().find('button').prop('disabled', true);
                        }
                        event.preventDefault();
                        if (!mQuery(this).hasClass('btn-nospin')) {
                            Mautic.startIconSpinOnEvent(event);
                        }
                        mQuery('#' + id).click();
                    });
                });
            }
        } else {
            mQuery('.toolbar-action-buttons').addClass('hide');
            if (mQuery('.toolbar-form-buttons').hasClass('hide')) {
                mQuery(container + ' .bottom-form-buttons').addClass('hide');
                var buttons = mQuery(container + " .bottom-form-buttons").html();
                mQuery(container + ' .toolbar-form-buttons .toolbar-standard').html('');
                mQuery(container + ' .toolbar-form-buttons .toolbar-dropdown .drop-menu').html('');
                var lastIndex = mQuery(buttons).filter("button").length - 1;
                mQuery(buttons).filter("button").each(function(i, v) {
                    var id = mQuery(this).attr('id');
                    var buttonClick = function(event) {
                        event.preventDefault();
                        if (!mQuery(this).hasClass('btn-dnd')) {
                            mQuery(this).parent().find('button').prop('disabled', true);
                        }
                        Mautic.startIconSpinOnEvent(event);
                        mQuery('#' + id).click();
                    };
                    mQuery("<button type='button' />").addClass(mQuery(this).attr('class')).addClass('btn-copy').attr('id', mQuery(this).attr('id') + '_toolbar').html(mQuery(this).html()).on('click.ajaxform', buttonClick).appendTo('.toolbar-form-buttons .toolbar-standard');
                    if (i === lastIndex) {
                        mQuery(".toolbar-form-buttons .toolbar-dropdown .btn-main").off('.ajaxform').attr('id', mQuery(this).attr('id') + '_toolbar_mobile').html(mQuery(this).html()).on('click.ajaxform', buttonClick);
                    } else {
                        mQuery("<a />").attr('id', mQuery(this).attr('id') + '_toolbar_mobile').html(mQuery(this).html()).on('click.ajaxform', buttonClick).appendTo(mQuery('<li />').prependTo('.toolbar-form-buttons .toolbar-dropdown .dropdown-menu'))
                    }
                });
                mQuery('.toolbar-form-buttons').removeClass('hide');
            }
        }
    });
    Mautic.activateGlobalFroalaOptions();
    if (mQuery(container + ' textarea.editor').length) {
        mQuery(container + ' textarea.editor').each(function() {
            var textarea = mQuery(this);
            if (textarea.hasClass('editor-builder-tokens')) {
                textarea.on('froalaEditor.initialized', function(e, editor) {
                    Mautic.initAtWho(editor.$el, textarea.attr('data-token-callback'), editor);
                });
                textarea.on('froalaEditor.focus', function(e, editor) {
                    Mautic.initAtWho(editor.$el, textarea.attr('data-token-callback'), editor);
                });
            }
            textarea.on('froalaEditor.blur', function(e, editor) {
                editor.popups.hideAll();
            });
            var maxButtons = ['undo', 'redo', '|', 'bold', 'italic', 'underline', 'paragraphFormat', 'fontFamily', 'fontSize', 'color', 'align', 'formatOL', 'formatUL', 'quote', 'clearFormatting', 'token', 'insertLink', 'insertImage', 'insertGatedVideo', 'insertTable', 'html', 'fullscreen'];
            var minButtons = ['undo', 'redo', '|', 'bold', 'italic', 'underline'];
            if (textarea.hasClass('editor-email')) {
                maxButtons = mQuery.grep(maxButtons, function(value) {
                    return value != 'insertGatedVideo';
                });
                maxButtons.push('dynamicContent');
            }
            if (textarea.hasClass('editor-dynamic-content')) {
                minButtons = ['undo', 'redo', '|', 'bold', 'italic', 'underline', 'paragraphFormat', 'fontFamily', 'fontSize', 'color', 'align', 'formatOL', 'formatUL', 'quote', 'clearFormatting', 'insertLink', 'insertImage', 'insertGatedVideo', 'insertTable', 'html', 'fullscreen'];
            }
            if (textarea.hasClass('editor-basic')) {
                minButtons = ['undo', 'redo', '|', 'bold', 'italic', 'underline', 'paragraphFormat', 'fontFamily', 'fontSize', 'color', 'align', 'formatOL', 'formatUL', 'quote', 'clearFormatting', 'insertLink', 'insertImage', 'insertTable', 'html', 'fullscreen'];
            }
            if (textarea.hasClass('editor-advanced') || textarea.hasClass('editor-basic-fullpage')) {
                var options = {
                    toolbarButtons: maxButtons,
                    toolbarButtonsMD: maxButtons,
                    heightMin: 300,
                    useClasses: false
                };
                if (textarea.hasClass('editor-basic-fullpage')) {
                    options.fullPage = true;
                    options.htmlAllowedTags = ['.*'];
                    options.htmlAllowedAttrs = ['.*'];
                    options.htmlRemoveTags = [];
                    options.lineBreakerTags = [];
                }
                textarea.on('froalaEditor.focus', function(e, editor) {
                    Mautic.showChangeThemeWarning = true;
                });
                textarea.froalaEditor(mQuery.extend({}, Mautic.basicFroalaOptions, options));
            } else {
                textarea.froalaEditor(mQuery.extend({}, Mautic.basicFroalaOptions, {
                    toolbarButtons: minButtons,
                    toolbarButtonsMD: minButtons,
                    toolbarButtonsSM: minButtons,
                    toolbarButtonsXS: minButtons,
                    heightMin: 100,
                    useClasses: false
                }));
            }
        });
    }
    if (mQuery(container + ' .dropdown-menu-form').length) {
        mQuery(container + ' .dropdown-menu-form').on('click', function(e) {
            e.stopPropagation();
        });
    }
    if (response && response.updateSelect && typeof response.id !== 'undefined') {
        Mautic.updateEntitySelect(response);
    }
    var contentSpecific = false;
    if (response && response.mauticContent) {
        contentSpecific = response.mauticContent;
    } else if (container == 'body') {
        contentSpecific = mauticContent;
    }
    if (response && response.sidebar) {
        var sidebarContent = mQuery('.app-sidebar.sidebar-left');
        var newSidebar = mQuery(response.sidebar);
        var nav = sidebarContent.find('li');
        if (nav.length) {
            var openNavIndex;
            nav.each(function(i, el) {
                var $el = mQuery(el);
                if ($el.hasClass('open')) {
                    openNavIndex = i;
                }
            });
            var openNav = mQuery(newSidebar.find('li')[openNavIndex]);
            openNav.addClass('open');
            openNav.find('ul').removeClass('collapse');
        }
        sidebarContent.html(newSidebar);
    }
    if (container == '#app-content' || container == 'body') {
        Mautic.bindGlobalKeyboardShortcuts();
        mQuery(".sidebar-left a[data-toggle='ajax']").on('click.ajax', function(event) {
            mQuery("html").removeClass('sidebar-open-ltr');
        });
        mQuery('.sidebar-right a[data-toggle="ajax"]').on('click.ajax', function(event) {
            mQuery("html").removeClass('sidebar-open-rtl');
        });
    }
    if (contentSpecific && typeof Mautic[contentSpecific + "OnLoad"] == 'function') {
        if (inModal || typeof Mautic.loadedContent[contentSpecific] == 'undefined') {
            Mautic.loadedContent[contentSpecific] = true;
            Mautic[contentSpecific + "OnLoad"](container, response);
        }
    }
    if (!inModal && container == 'body') {
        mQuery('#notificationsDropdown').on('click', function(e) {
            if (mQuery(e.target).hasClass('do-not-close')) {
                e.stopPropagation();
            }
        });
        if (mQuery('#globalSearchContainer').length) {
            mQuery('#globalSearchContainer .search-button').click(function() {
                mQuery('#globalSearchContainer').addClass('active');
                if (mQuery('#globalSearchInput').val()) {
                    mQuery('#globalSearchDropdown').addClass('open');
                }
                setTimeout(function() {
                    mQuery('#globalSearchInput').focus();
                }, 100);
                mQuery('body').on('click.globalsearch', function(event) {
                    var target = event.target;
                    if (!mQuery(target).parents('#globalSearchContainer').length && !mQuery(target).parents('#globalSearchDropdown').length) {
                        Mautic.closeGlobalSearchResults();
                    }
                });
            });
            mQuery("#globalSearchInput").on('change keyup paste', function() {
                if (mQuery(this).val()) {
                    mQuery('#globalSearchDropdown').addClass('open');
                } else {
                    mQuery('#globalSearchDropdown').removeClass('open');
                }
            });
            Mautic.activateLiveSearch("#globalSearchInput", "lastGlobalSearchStr", "globalLivecache");
        }
    }
    Mautic.renderCharts(container);
    Mautic.renderMaps(container);
    Mautic.stopIconSpinPostEvent();
    if ((response && typeof response.stopPageLoading != 'undefined' && response.stopPageLoading) || container == '#app-content' || container == '.page-list') {
        Mautic.stopPageLoadingBar();
    }
};
Mautic.activateLookupTypeahead = function(containerEl) {
    containerEl.find("*[data-toggle='field-lookup']").each(function() {
        var lookup = mQuery(this),
            callback = lookup.attr('data-callback') ? lookup.attr('data-callback') : 'activateFieldTypeahead';
        Mautic[callback](lookup.attr('id'), lookup.attr('data-target'), lookup.attr('data-options'), lookup.attr('data-action'));
    });
};
Mautic.makeConfirmationsAlive = function(jQueryObject) {
    jQueryObject.off('click.confirmation');
    jQueryObject.on('click.confirmation', function(event) {
        event.preventDefault();
        MauticVars.ignoreIconSpin = true;
        return Mautic.showConfirmation(this);
    });
};
Mautic.makeModalsAlive = function(jQueryObject) {
    jQueryObject.off('click.ajaxmodal');
    jQueryObject.on('click.ajaxmodal', function(event) {
        event.preventDefault();
        Mautic.ajaxifyModal(this, event);
    });
};
Mautic.makeLinksAlive = function(jQueryObject) {
    jQueryObject.off('click.ajax');
    jQueryObject.on('click.ajax', function(event) {
        event.preventDefault();
        return Mautic.ajaxifyLink(this, event);
    });
};
Mautic.onPageUnload = function(container, response) {
    if (typeof container != 'undefined') {
        mQuery(container + " *[data-toggle='tooltip']").tooltip('destroy');
        if (typeof MauticVars.modalsReset == 'undefined') {
            MauticVars.modalsReset = {};
        }
        mQuery(container + ' textarea.editor').each(function() {
            mQuery('textarea.editor').froalaEditor('destroy');
        });
        mQuery('html').off('fa.sidebar.minimize').off('fa.sidebar.maximize');
        mQuery(container + " input[data-toggle='color']").each(function() {
            mQuery(this).minicolors('destroy');
        });
    }
    var contentSpecific = false;
    if (container == '#app-content') {
        Mousetrap.reset();
        contentSpecific = mauticContent;
        if (typeof Mautic.chartObjects !== 'undefined') {
            mQuery.each(Mautic.chartObjects, function(i, chart) {
                chart.destroy();
            });
            Mautic.chartObjects = [];
        }
        if (typeof Mautic.mapObjects !== 'undefined') {
            mQuery.each(Mautic.mapObjects, function(i, map) {
                Mautic.destroyMap(map);
            });
            Mautic.mapObjects = [];
        }
        if (typeof Mautic.builderTokens !== 'undefined') {
            Mautic.builderTokens = {};
        }
    } else if (response && response.mauticContent) {
        contentSpecific = response.mauticContent;
    }
    if (contentSpecific) {
        if (typeof Mautic[contentSpecific + "OnUnload"] == 'function') {
            Mautic[contentSpecific + "OnUnload"](container, response);
        }
        if (typeof Mautic.loadedContent[contentSpecific] !== 'undefined') {
            delete Mautic.loadedContent[contentSpecific];
        }
    }
};
Mautic.ajaxifyLink = function(el, event) {
    if (mQuery(el).hasClass('disabled')) {
        return false;
    }
    var route = mQuery(el).attr('href');
    if (route.indexOf('javascript') >= 0 || MauticVars.routeInProgress === route) {
        return false;
    }
    if (route.indexOf('batchExport') >= 0) {
        Mautic.initiateFileDownload(route);
        return true;
    }
    if (event.ctrlKey || event.metaKey) {
        route = route.split("?")[0];
        window.open(route, '_blank');
        return;
    }
    if (mQuery(".form-exit-unlock-id").length) {
        if (mQuery(el).attr('data-ignore-formexit') != 'true') {
            var unlockParameter = (mQuery('.form-exit-unlock-parameter').length) ? mQuery('.form-exit-unlock-parameter').val() : '';
            Mautic.unlockEntity(mQuery('.form-exit-unlock-model').val(), mQuery('.form-exit-unlock-id').val(), unlockParameter);
        }
    }
    var link = mQuery(el).attr('data-menu-link');
    if (link !== undefined && link.charAt(0) != '#') {
        link = "#" + link;
    }
    var method = mQuery(el).attr('data-method');
    if (!method) {
        method = 'GET'
    }
    MauticVars.routeInProgress = route;
    var target = mQuery(el).attr('data-target');
    if (!target) {
        target = null;
    }
    var showLoadingBar = (mQuery(el).attr('data-hide-loadingbar')) ? false : true;
    if (mQuery('#globalSearchContainer').length && mQuery('#globalSearchContainer').hasClass('active')) {
        Mautic.closeGlobalSearchResults();
    }
    Mautic.loadContent(route, link, method, target, showLoadingBar);
};
Mautic.activateChosenSelect = function(el, ignoreGlobal, jQueryVariant) {
    var mQuery = (typeof jQueryVariant != 'undefined') ? jQueryVariant : window.mQuery;
    if (mQuery(el).parents('.no-chosen').length && !ignoreGlobal) {
        return;
    }
    var noResultsText = mQuery(el).data('no-results-text');
    if (!noResultsText) {
        noResultsText = mauticLang['chosenNoResults'];
    }
    var isLookup = mQuery(el).attr('data-chosen-lookup');
    if (isLookup) {
        if (mQuery(el).attr('data-new-route')) {
            mQuery(el).on('change', function() {
                var url = mQuery(el).attr('data-new-route');
                if (mQuery(el).val() == 'new' && (mQuery(el).attr('data-popup') == "true" || mQuery(el).closest('.modal').length > 0)) {
                    var queryGlue = url.indexOf('?') >= 0 ? '&' : '?';
                    mQuery(el).find('option[value="new"]').prop('selected', false);
                    mQuery(el).trigger('chosen:updated');
                    Mautic.loadNewWindow({
                        "windowUrl": url + queryGlue + "contentOnly=1&updateSelect=" + mQuery(el).attr('id')
                    });
                } else {
                    Mautic.loadAjaxModalBySelectValue(this, 'new', url, mQuery(el).attr('data-header'));
                }
            });
        }
        var multiPlaceholder = mauticLang['mautic.core.lookup.search_options'],
            singlePlaceholder = mauticLang['mautic.core.lookup.search_options'];
    } else {
        var multiPlaceholder = mauticLang['chosenChooseMore'],
            singlePlaceholder = mauticLang['chosenChooseOne'];
    }
    if (typeof mQuery(el).data('chosen-placeholder') !== 'undefined') {
        multiPlaceholder = singlePlaceholder = mQuery(el).data('chosen-placeholder');
    }
    mQuery(el).chosen({
        placeholder_text_multiple: multiPlaceholder,
        placeholder_text_single: singlePlaceholder,
        no_results_text: noResultsText,
        width: "100%",
        allow_single_deselect: true,
        include_group_label_in_selected: true,
        search_contains: true
    });
    if (isLookup) {
        var searchTerm = mQuery(el).attr('data-model');
        if (searchTerm) {
            mQuery(el).ajaxChosen({
                type: 'GET',
                url: mauticAjaxUrl + '?action=' + mQuery(el).attr('data-chosen-lookup'),
                dataType: 'json',
                afterTypeDelay: 2,
                minTermLength: 2,
                jsonTermKey: searchTerm,
                keepTypingMsg: "Keep typing...",
                lookingForMsg: "Looking for"
            });
        }
    }
};
Mautic.destroyChosen = function(el) {
    if (el.get(0)) {
        var eventObject = mQuery._data(el.get(0), 'events');
    }
    if (eventObject !== undefined && eventObject['chosen:activate'] !== undefined) {
        el.chosen('destroy');
        el.off('chosen:activate chosen:close chosen:open chosen:updated');
    }
};
Mautic.activateFieldTypeahead = function(field, target, options, action) {
    if (options && typeof options === 'String') {
        var keys = values = [];
        options = options.split('||');
        if (options.length == 2) {
            keys = options[1].split('|');
            values = options[0].split('|');
        } else {
            values = options[0].split('|');
        }
        var fieldTypeahead = Mautic.activateTypeahead('#' + field, {
            dataOptions: values,
            dataOptionKeys: keys,
            minLength: 0
        });
    } else {
        var typeAheadOptions = {
            prefetch: true,
            remote: true,
            action: action + "&field=" + target
        };
        if (('undefined' !== typeof options) && ('undefined' !== typeof options.limit)) {
            typeAheadOptions.limit = options.limit;
        }
        var fieldTypeahead = Mautic.activateTypeahead('#' + field, typeAheadOptions);
    }
    var callback = function(event, datum) {
        if (mQuery("#" + field).length && datum["value"]) {
            mQuery("#" + field).val(datum["value"]);
            var lookupCallback = mQuery('#' + field).data("lookup-callback");
            if (lookupCallback && typeof Mautic[lookupCallback] == 'function') {
                Mautic[lookupCallback](field, datum);
            }
        }
    };
    mQuery(fieldTypeahead).on('typeahead:selected', callback).on('typeahead:autocompleted', callback);
};
Mautic.activateMultiSelect = function(el) {
    var moveOption = function(v, prev) {
        var theOption = mQuery(el).find('option[value="' + v + '"]').first();
        var lastSelected = mQuery(el).find('option:not(:disabled)').filter(function() {
            return mQuery(this).prop('selected');
        }).last();
        if (typeof prev !== 'undefined') {
            if (prev) {
                var prevOption = mQuery(el).find('option[value="' + prev + '"]').first();
                theOption.insertAfter(prevOption);
                return;
            }
        } else if (lastSelected.length) {
            theOption.insertAfter(lastSelected);
            return;
        }
        theOption.prependTo(el);
    };
    mQuery(el).multiSelect({
        afterInit: function(container) {
            var funcName = mQuery(el).data('afterInit');
            if (funcName) {
                Mautic[funcName]('init', container);
            }
            var selectThat = this,
                $selectableSearch = this.$selectableUl.prev(),
                $selectionSearch = this.$selectionUl.prev(),
                selectableSearchString = '#' + this.$container.attr('id') + ' .ms-elem-selectable:not(.ms-selected)',
                selectionSearchString = '#' + this.$container.attr('id') + ' .ms-elem-selection.ms-selected';
            this.qs1 = $selectableSearch.quicksearch(selectableSearchString).on('keydown', function(e) {
                if (e.which === 40) {
                    selectThat.$selectableUl.focus();
                    return false;
                }
            });
            this.qs2 = $selectionSearch.quicksearch(selectionSearchString).on('keydown', function(e) {
                if (e.which == 40) {
                    selectThat.$selectionUl.focus();
                    return false;
                }
            });
            var selectOrder = mQuery(el).data('order');
            if (selectOrder && selectOrder.length > 1) {
                this.deselect_all();
                mQuery.each(selectOrder, function(k, v) {
                    selectThat.select(v);
                });
            }
            var isSortable = mQuery(el).data('sortable');
            if (isSortable) {
                mQuery(el).parent('.choice-wrapper').find('.ms-selection').first().sortable({
                    items: '.ms-elem-selection',
                    helper: function(e, ui) {
                        ui.width(mQuery(el).width());
                        return ui;
                    },
                    axis: 'y',
                    scroll: false,
                    update: function(event, ui) {
                        var prev = ui.item.prev();
                        var prevValue = (prev.length) ? prev.data('ms-value') : '';
                        moveOption(ui.item.data('ms-value'), prevValue);
                    }
                });
            }
        },
        afterSelect: function(value) {
            var funcName = mQuery(el).data('afterSelect');
            if (funcName) {
                Mautic[funcName]('select', value);
            }
            this.qs1.cache();
            this.qs2.cache();
            moveOption(value);
        },
        afterDeselect: function(value) {
            var funcName = mQuery(el).data('afterDeselect');
            if (funcName) {
                Mautic[funcName]('deselect', value);
            }
            this.qs1.cache();
            this.qs2.cache();
        },
        selectableHeader: "<input type='text' class='ms-search form-control' autocomplete='off'>",
        selectionHeader: "<input type='text' class='ms-search form-control' autocomplete='off'>",
        keepOrder: true
    });
};
Mautic.activateModalEmbeddedForms = function(container) {
    mQuery(container + " *[data-embedded-form='cancel']").off('click.embeddedform');
    mQuery(container + " *[data-embedded-form='cancel']").on('click.embeddedform', function(event) {
        event.preventDefault();
        var modal = mQuery(this).closest('.modal');
        mQuery(modal).modal('hide');
        if (mQuery(this).attr('data-embedded-form-clear') === 'true') {
            Mautic.resetForm(modal);
        }
        if (typeof mQuery(this).attr('data-embedded-form-callback') != 'undefined') {
            if (typeof window["Mautic"][mQuery(this).attr('data-embedded-form-callback')] == 'function') {
                window["Mautic"][mQuery(this).attr('data-embedded-form-callback')].apply('window', [this, modal]);
            }
        }
    });
    mQuery(container + " *[data-embedded-form='add']").each(function() {
        var submitButton = this;
        var modal = mQuery(this).closest('.modal');
        if (typeof mQuery(modal).data('bs.modal') !== 'undefined' && typeof mQuery(modal).data('bs.modal').options !== 'undefined') {
            mQuery(modal).data('bs.modal').options.keyboard = false;
            mQuery(modal).data('bs.modal').options.backdrop = 'static';
        } else {
            mQuery(modal).attr('data-keyboard', false);
            mQuery(modal).attr('data-backdrop', 'static');
        }
        mQuery(modal).on('show.bs.modal', function() {
            mQuery(this).on("keydown.embeddedForm", ":input:not(textarea)", function(event) {
                if (event.keyCode == 13) {
                    event.preventDefault();
                    if (event.metaKey || event.ctrlKey) {
                        mQuery(submitButton).click();
                    }
                }
            });
        });
        mQuery(modal).on('hidden.bs.modal', function() {
            mQuery(this).off("keydown.embeddedForm", ":input:not(textarea)");
        });
    });
    mQuery(container + " *[data-embedded-form='add']").off('click.embeddedform');
    mQuery(container + " *[data-embedded-form='add']").on('click.embeddedform', function(event) {
        event.preventDefault();
        var modal = mQuery(this).closest('.modal');
        mQuery(modal).modal('hide');
        if (typeof mQuery(this).attr('data-embedded-form-callback') != 'undefined') {
            if (typeof window["Mautic"][mQuery(this).attr('data-embedded-form-callback')] == 'function') {
                window["Mautic"][mQuery(this).attr('data-embedded-form-callback')].apply('window', [this, modal]);
            }
        }
    });
};
Mautic.activateDateTimeInputs = function(el, type) {
    if (typeof type == 'undefined') {
        type = 'datetime';
    }
    var format = mQuery(el).data('format');
    if (type == 'datetime') {
        mQuery(el).datetimepicker({
            format: (format) ? format : 'Y-m-d H:i',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false
        });
    } else if (type == 'date') {
        mQuery(el).datetimepicker({
            timepicker: false,
            format: (format) ? format : 'Y-m-d',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false,
            closeOnDateSelect: true
        });
    } else if (type == 'time') {
        mQuery(el).datetimepicker({
            datepicker: false,
            format: (format) ? format : 'H:i',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false
        });
    }
    mQuery(el).addClass('calendar-activated');
};
Mautic.activateSearchAutocomplete = function(elId, modelName) {
    if (mQuery('#' + elId).length) {
        var livesearch = (mQuery('#' + elId).attr("data-toggle=['livesearch']")) ? true : false;
        var typeaheadObject = Mautic.activateTypeahead('#' + elId, {
            prefetch: true,
            remote: false,
            limit: 0,
            action: 'commandList&model=' + modelName,
            multiple: true
        });
        mQuery(typeaheadObject).on('typeahead:selected', function(event, datum) {
            if (livesearch) {
                MauticVars.lastSearchStr = '';
                mQuery('#' + elId).keyup();
            }
        }).on('typeahead:autocompleted', function(event, datum) {
            if (livesearch) {
                MauticVars.lastSearchStr = '';
                mQuery('#' + elId).keyup();
            }
        });
    }
};
Mautic.activateLiveSearch = function(el, searchStrVar, liveCacheVar) {
    if (!mQuery(el).length) {
        return;
    }
    var btn = "button[data-livesearch-parent='" + mQuery(el).attr('id') + "']";
    mQuery(el).on('focus', function() {
        Mautic.currentSearchString = mQuery(this).val().trim();
    });
    mQuery(el).on('change keyup paste', {}, function(event) {
        var searchStr = mQuery(el).val().trim();
        var spaceKeyPressed = (event.which == 32 || event.keyCode == 32);
        var enterKeyPressed = (event.which == 13 || event.keyCode == 13);
        var deleteKeyPressed = (event.which == 8 || event.keyCode == 8);
        if (!enterKeyPressed && Mautic.currentSearchString && Mautic.currentSearchString == searchStr) {
            return;
        }
        var target = mQuery(el).attr('data-target');
        var diff = searchStr.length - MauticVars[searchStrVar].length;
        if (diff < 0) {
            diff = parseInt(diff) * -1;
        }
        var overlayEnabled = mQuery(el).attr('data-overlay');
        if (!overlayEnabled || overlayEnabled == 'false') {
            overlayEnabled = false;
        } else {
            overlayEnabled = true;
        }
        var overlayTarget = mQuery(el).attr('data-overlay-target');
        if (!overlayTarget) overlayTarget = target;
        if (overlayEnabled) {
            mQuery(el).off('blur.livesearchOverlay');
            mQuery(el).on('blur.livesearchOverlay', function() {
                mQuery(overlayTarget + ' .content-overlay').remove();
            });
        }
        if (!deleteKeyPressed && overlayEnabled) {
            var overlay = mQuery('<div />', {
                "class": "content-overlay"
            }).html(mQuery(el).attr('data-overlay-text'));
            if (mQuery(el).attr('data-overlay-background')) {
                overlay.css('background', mQuery(el).attr('data-overlay-background'));
            }
            if (mQuery(el).attr('data-overlay-color')) {
                overlay.css('color', mQuery(el).attr('data-overlay-color'));
            }
        }
        if ((!searchStr && MauticVars[searchStrVar].length) || diff >= 3 || spaceKeyPressed || enterKeyPressed) {
            MauticVars[searchStrVar] = searchStr;
            event.data.livesearch = true;
            Mautic.filterList(event, mQuery(el).attr('id'), mQuery(el).attr('data-action'), target, liveCacheVar, overlayEnabled, overlayTarget);
        } else if (overlayEnabled) {
            if (!mQuery(overlayTarget + ' .content-overlay').length) {
                mQuery(overlayTarget).prepend(overlay);
            }
        }
    });
    if (mQuery(btn).length) {
        mQuery(btn).on('click', {
            'parent': mQuery(el).attr('id')
        }, function(event) {
            var searchStr = mQuery(el).val().trim();
            MauticVars[searchStrVar] = searchStr;
            Mautic.filterButtonClicked = true;
            Mautic.filterList(event, event.data.parent, mQuery('#' + event.data.parent).attr('data-action'), mQuery('#' + event.data.parent).attr('data-target'), 'liveCache', mQuery(this).attr('data-livesearch-action'));
        });
        if (mQuery(el).val()) {
            mQuery(btn).attr('data-livesearch-action', 'clear');
            mQuery(btn + ' i').removeClass('fa-search').addClass('fa-eraser');
        } else {
            mQuery(btn).attr('data-livesearch-action', 'search');
            mQuery(btn + ' i').removeClass('fa-eraser').addClass('fa-search');
        }
    }
};
Mautic.activateListFilterSelect = function(el) {
    var filterName = mQuery(el).attr('name');
    var isMultiple = mQuery(el).attr('multiple') ? true : false;
    var prefixExceptions = mQuery(el).data('prefix-exceptions');
    if (isMultiple && prefixExceptions) {
        if (typeof Mautic.listFilterValues == 'undefined') {
            Mautic.listFilterValues = {};
        }
        Mautic.listFilterValues[filterName] = mQuery(el).val();
    }
    mQuery(el).on('change', function() {
        var filterVal = mQuery(this).val();
        if (filterVal == null) {
            filterVal = [];
        }
        if (prefixExceptions) {
            var limited = prefixExceptions.split(',');
            if (filterVal.length > 1) {
                for (var i = 0; i < filterVal.length; i++) {
                    if (mQuery.inArray(filterVal[i], Mautic.listFilterValues[filterName]) == -1) {
                        var newOption = mQuery(this).find('option[value="' + filterVal[i] + '"]');
                        var prefix = mQuery(newOption).parent().data('prefix');
                        if (mQuery.inArray(prefix, limited) != -1) {
                            mQuery(newOption).siblings().prop('selected', false);
                            filterVal = mQuery(this).val();
                            mQuery(this).trigger('chosen:updated');
                        }
                    }
                }
            }
            Mautic.listFilterValues[filterName] = filterVal;
        }
        var tmpl = mQuery(this).data('tmpl');
        if (!tmpl) {
            tmpl = 'list';
        }
        var filters = (isMultiple) ? JSON.stringify(filterVal) : filterVal;
        var request = window.location.pathname + '?tmpl=' + tmpl + '&' + filterName + '=' + filters;
        Mautic.loadContent(request, '', 'POST', mQuery(this).data('target'));
    });
};
Mautic.activateColorPicker = function(el, options) {
    var pickerOptions = mQuery(el).data('color-options');
    if (!pickerOptions) {
        pickerOptions = {
            theme: 'bootstrap',
            change: function(hex, opacity) {
                mQuery(el).trigger('change.minicolors', hex);
            }
        };
    }
    if (typeof options == 'object') {
        pickerOptions = mQuery.extend(pickerOptions, options);
    }
    mQuery(el).minicolors(pickerOptions);
};
Mautic.activateTypeahead = function(el, options) {
    if (typeof options == 'undefined' || !mQuery(el).length) {
        return;
    }
    if (typeof options.remote == 'undefined') {
        options.remote = (options.action) ? true : false;
    }
    if (typeof options.prefetch == 'undefined') {
        options.prefetch = false;
    }
    if (typeof options.limit == 'undefined') {
        options.limit = 5;
    }
    if (!options.displayKey) {
        options.displayKey = 'value';
    }
    if (typeof options.multiple == 'undefined') {
        options.multiple = false;
    }
    if (typeof options.minLength == 'undefined') {
        options.minLength = 2;
    }
    if (options.prefetch || options.remote) {
        if (typeof options.action == 'undefined') {
            return;
        }
        var sourceOptions = {
            datumTokenizer: Bloodhound.tokenizers.obj.whitespace(options.displayKey),
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            dupDetector: function(remoteMatch, localMatch) {
                return (remoteMatch[options.displayKey] == localMatch[options.displayKey]);
            },
            ttl: 15000,
            limit: options.limit
        };
        var filterClosure = function(list) {
            if (typeof list.ignore_wdt != 'undefined') {
                delete list.ignore_wdt;
            }
            if (typeof list.success != 'undefined') {
                delete list.success;
            }
            if (typeof list == 'object') {
                if (typeof list[0] != 'undefined') {
                    list = mQuery.map(list, function(el) {
                        return el;
                    });
                } else {
                    list = [];
                }
            }
            return list;
        };
        if (options.remote) {
            sourceOptions.remote = {
                url: mauticAjaxUrl + "?action=" + options.action + "&filter=%QUERY",
                filter: filterClosure
            };
        }
        if (options.prefetch) {
            sourceOptions.prefetch = {
                url: mauticAjaxUrl + "?action=" + options.action,
                filter: filterClosure
            };
        }
        var theBloodhound = new Bloodhound(sourceOptions);
        theBloodhound.initialize();
    } else {
        var substringMatcher = function(strs, strKeys) {
            return function findMatches(q, cb) {
                var matches, substrRegex;
                matches = [];
                substrRegex = new RegExp(q, 'i');
                mQuery.each(strs, function(i, str) {
                    if (typeof str == 'object') {
                        str = str[options.displayKey];
                    }
                    if (substrRegex.test(str)) {
                        var match = {};
                        match[options.displayKey] = str;
                        if (strKeys.length && typeof strKeys[i] != 'undefined') {
                            match['id'] = strKeys[i];
                        }
                        matches.push(match);
                    }
                });
                cb(matches);
            };
        };
        var lookupOptions = (options.dataOptions) ? options.dataOptions : mQuery(el).data('options');
        var lookupKeys = (options.dataOptionKeys) ? options.dataOptionKeys : [];
        if (!lookupOptions) {
            return;
        }
    }
    var theName = el.replace(/[^a-z0-9\s]/gi, '').replace(/[-\s]/g, '_');
    var theTypeahead = mQuery(el).typeahead({
        hint: true,
        highlight: true,
        minLength: options.minLength,
        multiple: options.multiple
    }, {
        name: theName,
        displayKey: options.displayKey,
        source: (typeof theBloodhound != 'undefined') ? theBloodhound.ttAdapter() : substringMatcher(lookupOptions, lookupKeys)
    }).on('keypress', function(event) {
        if ((event.keyCode || event.which) == 13) {
            mQuery(el).typeahead('close');
        }
    }).on('focus', function() {
        if (mQuery(el).typeahead('val') === '' && !options.minLength) {
            mQuery(el).data('ttTypeahead').input.trigger('queryChanged', '');
        }
    });
    return theTypeahead;
};
Mautic.activateSortable = function(el) {
    var prefix = mQuery(el).attr('data-prefix');
    if (mQuery('#' + prefix + '_additem').length) {
        mQuery('#' + prefix + '_additem').click(function() {
            var count = mQuery('#' + prefix + '_itemcount').val();
            var prototype = mQuery('#' + prefix + '_additem').attr('data-prototype');
            prototype = prototype.replace(/__name__/g, count);
            mQuery(prototype).appendTo(mQuery('#' + prefix + '_list div.list-sortable'));
            mQuery('#' + prefix + '_list_' + count).focus();
            count++;
            mQuery('#' + prefix + '_itemcount').val(count);
            return false;
        });
    }
    mQuery('#' + prefix + '_list div.list-sortable').sortable({
        items: 'div.sortable',
        handle: 'span.postaddon',
        axis: 'y',
        containment: '#' + prefix + '_list',
        stop: function(i) {
            var order = 0;
            mQuery('#' + prefix + '_list div.list-sortable div.input-group input').each(function() {
                var name = mQuery(this).attr('name');
                if (mQuery(this).hasClass('sortable-label')) {
                    name = name.replace(/(\[list\]\[[0-9]+\]\[label\])$/g, '') + '[list][' + order + '][label]';
                } else if (mQuery(this).hasClass('sortable-value')) {
                    name = name.replace(/(\[list\]\[[0-9]+\]\[value\])$/g, '') + '[list][' + order + '][value]';
                    order++;
                } else {
                    name = name.replace(/(\[list\]\[[0-9]+\])$/g, '') + '[list][' + order + ']';
                    order++;
                }
                mQuery(this).attr('name', name);
            });
        }
    });
};
Mautic.closeGlobalSearchResults = function() {
    mQuery('#globalSearchContainer').removeClass('active');
    mQuery('#globalSearchDropdown').removeClass('open');
    mQuery('body').off('click.globalsearch');
};
Mautic.initiateFileDownload = function(link) {
    var iframe = mQuery("<iframe/>").attr({
        src: link,
        style: "visibility:hidden;display:none"
    }).appendTo(mQuery('body'));
};;
Mautic.downloadIpLookupDataStore = function() {
    var ipService = mQuery('#config_coreconfig_ip_lookup_service').val();
    var ipAuth = mQuery('#config_coreconfig_ip_lookup_auth').val();
    mQuery('#iplookup_fetch_button_container .fa-spinner').removeClass('hide');
    Mautic.ajaxActionRequest('downloadIpLookupDataStore', {
        service: ipService,
        auth: ipAuth
    }, function(response) {
        mQuery('#iplookup_fetch_button_container .fa-spinner').addClass('hide');
        if (response.message) {
            mQuery('#iplookup_fetch_button_container').parent().removeClass('has-error').addClass('has-success');
            mQuery('#iplookup_fetch_button_container').next('.help-block').html(response.message);
        } else if (response.error) {
            mQuery('#iplookup_fetch_button_container').parent().removeClass('has-success').addClass('has-error');
            mQuery('#iplookup_fetch_button_container').next('.help-block').html(response.error);
        }
    });
};
Mautic.getIpLookupFormConfig = function() {
    var ipService = mQuery('#config_coreconfig_ip_lookup_service').val();
    Mautic.activateLabelLoadingIndicator('config_coreconfig_ip_lookup_service');
    Mautic.ajaxActionRequest('getIpLookupForm', {
        service: ipService
    }, function(response) {
        Mautic.removeLabelLoadingIndicator();
        mQuery('#ip_lookup_config_container').html(response.html);
        mQuery('#ip_lookup_attribution').html(response.attribution);
    });
};;
Mautic.processUpdate = function(container, step, state) {
    var baseUrl = mauticBasePath + '/';
    switch (step) {
        case 1:
            mQuery.ajax({
                showLoadingBar: true,
                url: mauticAjaxUrl + '?action=core:updateSetUpdateLayout',
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        mQuery('div[id=' + container + ']').html(response.content);
                        Mautic.processUpdate(container, step + 1, state);
                    } else if (response.redirect) {
                        window.location = response.redirect;
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                }
            });
            break;
        case 2:
            mQuery.ajax({
                showLoadingBar: true,
                url: mauticAjaxUrl + '?action=core:updateDownloadPackage',
                dataType: 'json',
                success: function(response) {
                    if (response.redirect) {
                        window.location = response.redirect;
                    } else {
                        mQuery('td[id=update-step-downloading-status]').html('<span class="hidden-xs">' + response.stepStatus + '</span>');
                        if (response.success) {
                            mQuery('td[id=update-step-downloading-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-check text-success'));
                            mQuery('#updateTable tbody').append('<tr><td>' + response.nextStep + '</td><td id="update-step-extracting-status"><span class="hidden-xs">' + response.nextStepStatus + '</span><i class="pull-right fa fa-spinner fa-spin"></i></td></tr>');
                            Mautic.processUpdate(container, step + 1, state);
                        } else {
                            mQuery('td[id=update-step-downloading-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-warning text-danger'));
                            mQuery('div[id=main-update-panel]').removeClass('panel-default').addClass('panel-danger');
                            mQuery('div#main-update-panel div.panel-body').prepend('<div class="alert alert-danger">' + response.message + '</div>');
                        }
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                }
            });
            break;
        case 3:
            mQuery.ajax({
                showLoadingBar: true,
                url: mauticAjaxUrl + '?action=core:updateExtractPackage',
                dataType: 'json',
                success: function(response) {
                    if (response.redirect) {
                        window.location = response.redirect;
                    } else {
                        mQuery('td[id=update-step-extracting-status]').html('<span class="hidden-xs">' + response.stepStatus + '</span>');
                        if (response.success) {
                            mQuery('td[id=update-step-extracting-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-check text-success'));
                            mQuery('#updateTable tbody').append('<tr><td>' + response.nextStep + '</td><td id="update-step-moving-status"><span class="hidden-xs">' + response.nextStepStatus + '</span><i class="pull-right fa fa-spinner fa-spin"></i></td></tr>');
                            Mautic.processUpdate(container, step + 1, state);
                        } else {
                            mQuery('td[id=update-step-extracting-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-warning text-danger'));
                            mQuery('div[id=main-update-panel]').removeClass('panel-default').addClass('panel-danger');
                            mQuery('div#main-update-panel div.panel-body').prepend('<div class="alert alert-danger">' + response.message + '</div>');
                        }
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                }
            });
            break;
        case 4:
            mQuery.ajax({
                showLoadingBar: true,
                url: baseUrl + 'upgrade/upgrade.php?task=moveBundles&updateState=' + state,
                dataType: 'json',
                success: function(response) {
                    if (response.redirect) {
                        window.location = response.redirect;
                    } else {
                        mQuery('td[id=update-step-moving-status]').html('<span class="hidden-xs">' + response.stepStatus + '</span>');
                        if (response.error) {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-warning text-danger'));
                            mQuery('div[id=main-update-panel]').removeClass('panel-default').addClass('panel-danger');
                            mQuery('div#main-update-panel div.panel-body').prepend('<div class="alert alert-danger">' + response.message + '</div>');
                        } else if (response.complete) {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-spinner fa-spin'));
                            Mautic.processUpdate(container, step + 1, response.updateState);
                        } else {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-spinner fa-spin'));
                            Mautic.processUpdate(container, step, response.updateState);
                        }
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                }
            });
            break;
        case 5:
            mQuery.ajax({
                showLoadingBar: true,
                url: baseUrl + 'upgrade/upgrade.php?task=moveCore&updateState=' + state,
                dataType: 'json',
                success: function(response) {
                    if (response.redirect) {
                        window.location = response.redirect;
                    } else {
                        mQuery('td[id=update-step-moving-status]').html('<span class="hidden-xs">' + response.stepStatus + '</span>');
                        if (response.error) {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-warning text-danger'));
                            mQuery('div[id=main-update-panel]').removeClass('panel-default').addClass('panel-danger');
                            mQuery('div#main-update-panel div.panel-body').prepend('<div class="alert alert-danger">' + response.message + '</div>');
                        } else if (response.complete) {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-spinner fa-spin'));
                            Mautic.processUpdate(container, step + 1, response.updateState);
                        } else {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-spinner fa-spin'));
                            Mautic.processUpdate(container, step, response.updateState);
                        }
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                }
            });
            break;
        case 6:
            mQuery.ajax({
                showLoadingBar: true,
                url: baseUrl + 'upgrade/upgrade.php?task=moveVendors&updateState=' + state,
                dataType: 'json',
                success: function(response) {
                    if (response.redirect) {
                        window.location = response.redirect;
                    } else {
                        mQuery('td[id=update-step-moving-status]').html('<span class="hidden-xs">' + response.stepStatus + '</span>');
                        if (response.error) {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-warning text-danger'));
                            mQuery('div[id=main-update-panel]').removeClass('panel-default').addClass('panel-danger');
                            mQuery('div#main-update-panel div.panel-body').prepend('<div class="alert alert-danger">' + response.message + '</div>');
                        } else if (response.complete) {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-check text-success'));
                            mQuery('#updateTable tbody').append('<tr><td>' + response.nextStep + '</td><td id="update-step-cache-status"><span class="hidden-xs">' + response.nextStepStatus + '</span><i class="pull-right fa fa-spinner fa-spin"></i></td></tr>');
                            Mautic.processUpdate(container, step + 1, response.updateState);
                        } else {
                            mQuery('td[id=update-step-moving-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-spinner fa-spin'));
                            Mautic.processUpdate(container, step, response.updateState);
                        }
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                }
            });
            break;
        case 7:
            mQuery.ajax({
                showLoadingBar: true,
                url: baseUrl + 'upgrade/upgrade.php?task=clearCache&updateState=' + state,
                dataType: 'json',
                success: function(response) {
                    if (response.redirect) {
                        window.location = response.redirect;
                    } else {
                        mQuery('td[id=update-step-cache-status]').html('<span class="hidden-xs">' + response.stepStatus + '</span>');
                        if (response.error) {
                            mQuery('td[id=update-step-cache-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-warning text-danger'));
                            mQuery('div[id=main-update-panel]').removeClass('panel-default').addClass('panel-danger');
                            mQuery('div#main-update-panel div.panel-body').prepend('<div class="alert alert-danger">' + response.message + '</div>');
                        } else if (response.complete) {
                            mQuery('td[id=update-step-cache-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-check text-success'));
                            mQuery('#updateTable tbody').append('<tr><td>' + response.nextStep + '</td><td id="update-step-database-status"><span class="hidden-xs">' + response.nextStepStatus + '</span><i class="pull-right fa fa-spinner fa-spin"></i></td></tr>');
                            Mautic.processUpdate(container, step + 1, response.updateState);
                        } else {
                            mQuery('td[id=update-step-cache-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-spinner fa-spin'));
                            Mautic.processUpdate(container, step, response.updateState);
                        }
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                    Mautic.processUpdate(container, step, response.updateState);
                }
            });
            break;
        case 8:
            mQuery.ajax({
                showLoadingBar: true,
                url: mauticAjaxUrl + '?action=core:updateDatabaseMigration&finalize=1',
                dataType: 'json',
                success: function(response) {
                    if (response.redirect) {
                        window.location = response.redirect;
                    } else {
                        mQuery('td[id=update-step-database-status]').html('<span class="hidden-xs">' + response.stepStatus + '</span>');
                        if (response.success) {
                            mQuery('td[id=update-step-database-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-check text-success'));
                            mQuery('#updateTable tbody').append('<tr><td>' + response.nextStep + '</td><td id="update-step-finalization-status"><span class="hidden-xs">' + response.nextStepStatus + '</span><i class="pull-right fa fa-spinner fa-spin"></i></td></tr>');
                            Mautic.processUpdate(container, step + 1, state);
                        } else {
                            mQuery('td[id=update-step-database-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-warning text-danger'));
                            mQuery('div[id=main-update-panel]').removeClass('panel-default').addClass('panel-danger');
                            mQuery('div#main-update-panel div.panel-body').prepend('<div class="alert alert-danger">' + response.message + '</div>');
                        }
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    window.location = mauticBaseUrl + 's/update/schema?update=1';
                }
            });
            break;
        case 9:
            mQuery.ajax({
                showLoadingBar: true,
                url: mauticAjaxUrl + '?action=core:updateFinalization',
                dataType: 'json',
                success: function(response) {
                    if (response.redirect) {
                        window.location = response.redirect;
                    } else {
                        if (response.success) {
                            mQuery('div[id=' + container + ']').html('<div class="alert alert-mautic">' + response.message + '</div>');
                            if (response.postmessage) {
                                mQuery('<div>' + response.postmessage + '</div>').insertAfter('div[id=' + container + '] .alert');
                            }
                        } else {
                            mQuery('td[id=update-step-finalization-status]').html('<span class="hidden-xs">' + response.stepStatus + '</span>');
                            mQuery('td[id=update-step-finalization-status]').append(mQuery('<i></i>').addClass('pull-right fa fa-warning text-danger'));
                            mQuery('div[id=main-update-panel]').removeClass('panel-default').addClass('panel-danger');
                            mQuery('div#main-update-panel div.panel-body').prepend('<div class="alert alert-danger">' + response.message + '</div>');
                        }
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                }
            });
            break;
    }
    Mautic.stopPageLoadingBar();
};;
Mautic.getUrlParameter = function(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
};
Mautic.launchBuilder = function(formName, actionName) {
    var builder = mQuery('.builder');
    Mautic.codeMode = builder.hasClass('code-mode');
    Mautic.showChangeThemeWarning = true;
    mQuery('body').css('overflow-y', 'hidden');
    builder.addClass('builder-active').removeClass('hide');
    if (typeof actionName == 'undefined') {
        actionName = formName;
    }
    var builderCss = {
        margin: "0",
        padding: "0",
        border: "none",
        width: "100%",
        height: "100%"
    };
    var themeHtml = mQuery('textarea.builder-html').val();
    if (Mautic.codeMode) {
        var rawTokens = mQuery.map(Mautic.builderTokens, function(element, index) {
            return index
        }).sort();
        Mautic.builderCodeMirror = CodeMirror(document.getElementById('customHtmlContainer'), {
            value: themeHtml,
            lineNumbers: true,
            mode: 'htmlmixed',
            extraKeys: {
                "Ctrl-Space": "autocomplete"
            },
            lineWrapping: true,
            hintOptions: {
                hint: function(editor) {
                    var cursor = editor.getCursor();
                    var currentLine = editor.getLine(cursor.line);
                    var start = cursor.ch;
                    var end = start;
                    while (end < currentLine.length && /[\w|}$]+/.test(currentLine.charAt(end))) ++end;
                    while (start && /[\w|{$]+/.test(currentLine.charAt(start - 1))) --start;
                    var curWord = start != end && currentLine.slice(start, end);
                    var regex = new RegExp('^' + curWord, 'i');
                    var result = {
                        list: (!curWord ? rawTokens : mQuery(rawTokens).filter(function(idx) {
                            return (rawTokens[idx].indexOf(curWord) !== -1);
                        })),
                        from: CodeMirror.Pos(cursor.line, start),
                        to: CodeMirror.Pos(cursor.line, end)
                    };
                    return result;
                }
            }
        });
        Mautic.keepPreviewAlive('builder-template-content');
    } else {
        var isPrefCenterEnabled = eval(parent.mQuery('input[name="page[isPreferenceCenter]"]:checked').val());
        var slots = ['segmentlist', 'categorylist', 'preferredchannel', 'channelfrequency', 'saveprefsbutton', 'successmessage'];
        mQuery.each(slots, function(i, s) {
            if (isPrefCenterEnabled) {
                mQuery('[data-slot-type=' + s + ']').show();
            } else {
                mQuery('[data-slot-type=' + s + ']').hide();
            }
        });
    }
    var builderPanel = mQuery('.builder-panel');
    var builderContent = mQuery('.builder-content');
    var btnCloseBuilder = mQuery('.btn-close-builder');
    var applyBtn = mQuery('.btn-apply-builder');
    var panelHeight = (builderContent.css('right') == '0px') ? builderPanel.height() : 0;
    var panelWidth = (builderContent.css('right') == '0px') ? 0 : builderPanel.width();
    var spinnerLeft = (mQuery(window).width() - panelWidth - 60) / 2;
    var spinnerTop = (mQuery(window).height() - panelHeight - 60) / 2;
    var form = mQuery('form[name=' + formName + ']');
    applyBtn.off('click').on('click', function(e) {
        Mautic.activateButtonLoadingIndicator(applyBtn);
        try {
            Mautic.sendBuilderContentToTextarea(function() {
                if (typeof document.getElementById('builder-template-content').contentWindow.Mautic !== 'undefined') {
                    document.getElementById('builder-template-content').contentWindow.Mautic.destroySlots();
                }
                mQuery('#slot-form-container, #section-form-container').html('');
                Mautic.inBuilderSubmissionOn(form);
                var bgApplyBtn = mQuery('.btn-apply');
                if (0 === bgApplyBtn.length && ("1" === Mautic.getUrlParameter('contentOnly') || Mautic.isInBuilder)) {
                    var frm = mQuery('.btn-save').closest('form');
                    Mautic.inBuilderSubmissionOn(frm);
                    frm.submit();
                    Mautic.inBuilderSubmissionOff();
                } else {
                    bgApplyBtn.trigger('click');
                }
                Mautic.inBuilderSubmissionOff();
            }, true);
        } catch (error) {
            Mautic.removeButtonLoadingIndicator(applyBtn);
            if (/SYNTAX ERROR/.test(error.message.toUpperCase())) {
                var errorMessage = 'Syntax error. Please check your HTML code.';
                alert(errorMessage);
                console.error(errorMessage);
            }
            console.error(error.message);
        }
    });
    builderPanel.on('scroll', function(e) {
        if (mQuery.find('.fr-popup:visible').length) {
            if (!Mautic.isInViewport(builderPanel.find('.fr-view:visible'))) {
                builderPanel.find('.fr-view:visible').blur();
                builderPanel.find('input:focus').blur();
            }
        } else {
            builderPanel.find('input:focus').blur();
        }
    });
    var overlay = mQuery('<div id="builder-overlay" class="modal-backdrop fade in"><div style="position: absolute; top:' + spinnerTop + 'px; left:' + spinnerLeft + 'px" class="builder-spinner"><i class="fa fa-spinner fa-spin fa-5x"></i></div></div>').css(builderCss).appendTo('.builder-content');
    btnCloseBuilder.prop('disabled', true);
    applyBtn.prop('disabled', true);
    var assets = Mautic.htmlspecialchars_decode(mQuery('[data-builder-assets]').html());
    themeHtml = themeHtml.replace('</head>', assets + '</head>');
    Mautic.initBuilderIframe(themeHtml, btnCloseBuilder, applyBtn);
};
Mautic.isInViewport = function(el) {
    var elementTop = mQuery(el).offset().top;
    var elementBottom = elementTop + mQuery(el).outerHeight();
    var viewportTop = mQuery(window).scrollTop();
    var viewportBottom = viewportTop + mQuery(window).height();
    return elementBottom > viewportTop && elementTop < viewportBottom;
};
Mautic.inBuilderSubmissionOn = function(form) {
    var inBuilder = mQuery('<input type="hidden" name="inBuilder" value="1" />');
    form.append(inBuilder);
}
Mautic.inBuilderSubmissionOff = function(form) {
    Mautic.isInBuilder = false;
    mQuery('input[name="inBuilder"]').remove();
}
Mautic.processBuilderErrors = function(response) {
    if (response.validationError) {
        mQuery('.btn-apply-builder').attr('disabled', true);
        mQuery('#builder-errors').show('fast').text(response.validationError);
    }
};
Mautic.formatCode = function() {
    Mautic.builderCodeMirror.autoFormatRange({
        line: 0,
        ch: 0
    }, {
        line: Mautic.builderCodeMirror.lineCount()
    });
}
Mautic.openMediaManager = function() {
    Mautic.openServerBrowser(mauticBasePath + '/elfinder', screen.width * 0.7, screen.height * 0.7);
}
Mautic.setFileUrl = function(url, width, height, alt) {
    Mautic.insertTextAtCMCursor(url);
}
Mautic.insertTextAtCMCursor = function(text) {
    var doc = Mautic.builderCodeMirror.getDoc();
    var cursor = doc.getCursor();
    doc.replaceRange(text, cursor);
}
Mautic.openServerBrowser = function(url, width, height) {
    var iLeft = (screen.width - width) / 2;
    var iTop = (screen.height - height) / 2;
    var sOptions = "toolbar=no,status=no,resizable=yes,dependent=yes";
    sOptions += ",width=" + width;
    sOptions += ",height=" + height;
    sOptions += ",left=" + iLeft;
    sOptions += ",top=" + iTop;
    var oWindow = window.open(url, "BrowseWindow", sOptions);
}
Mautic.keepPreviewAlive = function(iframeId, slot) {
    var codeChanged = false;
    Mautic.builderCodeMirror.on('change', function(cm, change) {
        codeChanged = true;
    });
    window.setInterval(function() {
        if (codeChanged) {
            var value = (Mautic.builderCodeMirror) ? Mautic.builderCodeMirror.getValue() : '';
            if (!Mautic.codeMode) {
                Mautic.setCodeModeSlotContent(slot, value);
            }
            Mautic.livePreviewInterval = Mautic.updateIframeContent(iframeId, value, slot);
            codeChanged = false;
        }
    }, 2000);
};
Mautic.isValidHtml = function(html) {
    var doc = document.createElement('div');
    doc.innerHTML = html;
    return (doc.innerHTML === html);
}
Mautic.setCodeModeSlotContent = function(slot, content) {
    if (Mautic.isValidHtml(content)) {
        slot.removeAttr('data-encode');
    } else {
        slot.attr('data-encode', btoa(content));
    }
}
Mautic.geCodeModetSlotContent = function(slot) {
    var html = slot.html();
    if (slot.attr('data-encode')) {
        html = atob(slot.attr('data-encode'));
    }
    return html;
}
Mautic.prepareCodeModeBlocksBeforeSave = function(themeHtml) {
    var parser = new DOMParser();
    var el = parser.parseFromString(themeHtml, "text/html");
    var $b = mQuery(el);
    var codeBlocks = {};
    $b.find('#codemodeHtmlContainer,.codemodeHtmlContainer').each(function(index) {
        var html = mQuery(this).html();
        if (mQuery(this).attr('data-encode')) {
            html = atob(mQuery(this).attr('data-encode'));
            var token = '{CODEMODEBLOCK' + index + '}';
            codeBlocks[token] = html;
            mQuery(this).html(token);
        }
    })
    themeHtml = Mautic.domToString($b);
    for (codeBlock in codeBlocks) {
        themeHtml = themeHtml.replace(codeBlock, codeBlocks[codeBlock]);
    }
    return themeHtml;
}
Mautic.killLivePreview = function() {
    window.clearInterval(Mautic.livePreviewInterval);
};
Mautic.destroyCodeMirror = function() {
    delete Mautic.builderCodeMirror;
    mQuery('#customHtmlContainer').empty();
};
Mautic.buildBuilderIframe = function(themeHtml, id, onLoadCallback) {
    if (mQuery('iframe#' + id).length) {
        var builder = mQuery('iframe#' + id);
    } else {
        var builder = mQuery("<iframe />", {
            css: {
                margin: "0",
                padding: "0",
                border: "none",
                width: "100%",
                height: "100%"
            },
            id: id
        }).appendTo('.builder-content');
    }
    builder.off('load').on('load', function() {
        if (typeof onLoadCallback === 'function') {
            onLoadCallback();
        }
    });
    Mautic.updateIframeContent(id, themeHtml);
};
Mautic.htmlspecialchars_decode = function(encodedHtml) {
    encodedHtml = encodedHtml.replace(/&quot;/g, '"');
    encodedHtml = encodedHtml.replace(/&#039;/g, "'");
    encodedHtml = encodedHtml.replace(/&amp;/g, '&');
    encodedHtml = encodedHtml.replace(/&lt;/g, '<');
    encodedHtml = encodedHtml.replace(/&gt;/g, '>');
    return encodedHtml;
};
Mautic.initSelectTheme = function(themeField) {
    var customHtml = mQuery('textarea.builder-html');
    var isNew = Mautic.isNewEntity('#page_sessionId, #emailform_sessionId');
    Mautic.showChangeThemeWarning = true;
    Mautic.builderTheme = themeField.val();
    if (isNew) {
        Mautic.showChangeThemeWarning = false;
        if (!customHtml.length || !customHtml.val().length) {
            Mautic.setThemeHtml(Mautic.builderTheme);
        }
    }
    if (customHtml.length) {
        mQuery('[data-theme]').click(function(e) {
            e.preventDefault();
            var currentLink = mQuery(this);
            var theme = currentLink.attr('data-theme');
            var isCodeMode = (theme === 'mautic_code_mode');
            Mautic.builderTheme = theme;
            if (Mautic.showChangeThemeWarning && customHtml.val().length) {
                if (!isCodeMode) {
                    if (confirm(Mautic.translate('mautic.core.builder.theme_change_warning'))) {
                        customHtml.val('');
                        Mautic.showChangeThemeWarning = false;
                    } else {
                        return;
                    }
                } else {
                    if (confirm(Mautic.translate('mautic.core.builder.code_mode_warning'))) {} else {
                        return;
                    }
                }
            }
            themeField.val(theme);
            if (isCodeMode) {
                mQuery('.builder').addClass('code-mode');
                mQuery('.builder .code-editor').removeClass('hide');
                mQuery('.builder .code-mode-toolbar').removeClass('hide');
                mQuery('.builder .builder-toolbar').addClass('hide');
            } else {
                mQuery('.builder').removeClass('code-mode');
                mQuery('.builder .code-editor').addClass('hide');
                mQuery('.builder .code-mode-toolbar').addClass('hide');
                mQuery('.builder .builder-toolbar').removeClass('hide');
                Mautic.setThemeHtml(theme);
            }
            mQuery('.theme-list .panel').removeClass('theme-selected');
            currentLink.closest('.panel').addClass('theme-selected');
            mQuery('.theme-list .select-theme-selected').addClass('hide');
            mQuery('.theme-list .select-theme-link').removeClass('hide');
            currentLink.closest('.panel').find('.select-theme-selected').removeClass('hide');
            currentLink.addClass('hide');
        });
    }
};
Mautic.updateIframeContent = function(iframeId, content, slot) {
    content = content.replace(/^\s*[\r\n]/gm, '');
    if (iframeId) {
        var iframe = document.getElementById(iframeId);
        var doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(content);
        doc.close();
        if ('HTML' === doc.all[0].tagName) {
            mQuery(doc.all[0]).removeClass();
        }
    } else if (slot) {
        slot.html(content);
        Mautic.setEmptySlotPlaceholder(slot.parent());
    }
};
Mautic.setThemeHtml = function(theme) {
    mQuery.get(mQuery('#builder_url').val() + '?template=' + theme, function(themeHtml) {
        var textarea = mQuery('textarea.builder-html');
        textarea.val(themeHtml);
    });
};
Mautic.closeBuilder = function(model) {
    var panelHeight = (mQuery('.builder-content').css('right') == '0px') ? mQuery('.builder-panel').height() : 0,
        panelWidth = (mQuery('.builder-content').css('right') == '0px') ? 0 : mQuery('.builder-panel').width(),
        spinnerLeft = (mQuery(window).width() - panelWidth - 60) / 2,
        spinnerTop = (mQuery(window).height() - panelHeight - 60) / 2,
        closeBtn = mQuery('.btn-close-builder'),
        overlay = mQuery('#builder-overlay'),
        builder = mQuery('.builder');
    mQuery('.builder-spinner').css({
        left: spinnerLeft,
        top: spinnerTop
    });
    overlay.removeClass('hide');
    closeBtn.prop('disabled', true);
    mQuery('#builder-errors').hide('fast').text('');
    try {
        Mautic.sendBuilderContentToTextarea(function() {
            if (Mautic.codeMode) {
                Mautic.killLivePreview();
                Mautic.destroyCodeMirror();
                delete Mautic.codeMode;
            } else {
                if (typeof document.getElementById('builder-template-content').contentWindow.Mautic !== 'undefined') {
                    document.getElementById('builder-template-content').contentWindow.Mautic.destroySlots();
                }
                mQuery('#slot-form-container, #section-form-container').html('');
            }
            overlay.remove();
            builder.removeClass('builder-active').addClass('hide');
            closeBtn.prop('disabled', false);
            mQuery('body').css('overflow-y', '');
            builder.addClass('hide');
            Mautic.stopIconSpinPostEvent();
            mQuery('#builder-template-content').remove();
        }, false);
    } catch (error) {
        overlay.addClass('hide');
        closeBtn.prop('disabled', false);
        if (/SYNTAX ERROR/.test(error.message.toUpperCase())) {
            var errorMessage = 'Syntax error. Please check your HTML code.';
            alert(errorMessage);
            console.error(errorMessage);
        }
        console.error(error.message);
    }
};
Mautic.sendBuilderContentToTextarea = function(callback, keepBuilderContent) {
    var customHtml;
    if (Mautic.codeMode) {
        customHtml = Mautic.builderCodeMirror.getValue();
        customHtml = Mautic.convertDynamicContentSlotsToTokens(customHtml);
        mQuery('.builder-html').val(customHtml);
        callback();
    } else {
        var builderHtml = mQuery('iframe#builder-template-content').contents();
        if (keepBuilderContent) {
            Mautic.cloneHtmlContent(builderHtml, function(themeHtml) {
                Mautic.sanitizeHtmlAndStoreToTextarea(themeHtml);
                callback();
            });
        } else {
            Mautic.sanitizeHtmlAndStoreToTextarea(builderHtml);
            callback();
        }
    }
};
Mautic.sanitizeHtmlAndStoreToTextarea = function(html) {
    var cleanHtml = Mautic.sanitizeHtmlBeforeSave(html);
    mQuery('.builder-html').val(Mautic.domToString(cleanHtml));
};
Mautic.domToString = function(dom) {
    if (typeof dom === 'string') {
        return dom;
    }
    var xs = new XMLSerializer();
    return xs.serializeToString(dom.get(0));
};
Mautic.sanitizeHtmlBeforeSave = function(htmlContent) {
    htmlContent.find('[data-source="mautic"]').remove();
    htmlContent.find('.atwho-container').remove();
    htmlContent.find('.fr-image-overlay, .fr-quick-insert, .fr-tooltip, .fr-toolbar, .fr-popup, .fr-image-resizer').remove();
    htmlContent.find('[data-slot-focus], [data-section-focus]').remove();
    var customHtml = Mautic.domToString(htmlContent).replace(/url\(&quot;(.+)&quot;\)/g, 'url(\'$1\')');
    customHtml = Mautic.convertDynamicContentSlotsToTokens(customHtml);
    return Mautic.prepareCodeModeBlocksBeforeSave(customHtml);
};
Mautic.cloneHtmlContent = function(content, callback) {
    var id = 'iframe-helper';
    var iframeHelper = mQuery('<iframe id="' + id + '" />');
    Mautic.buildBuilderIframe(Mautic.domToString(content), id, function() {
        callback(mQuery('iframe#' + id).contents());
        iframeHelper.remove();
    });
}
Mautic.destroySlots = function() {
    if (typeof Mautic.builderSlots !== 'undefined' && Mautic.builderSlots.length) {
        mQuery.each(Mautic.builderSlots, function(i, slotParams) {
            mQuery(slotParams.slot).trigger('slot:destroy', slotParams);
        });
        delete Mautic.builderSlots;
    }
    Mautic.builderContents.find('[data-slot-container]').sortable().sortable('destroy');
    Mautic.builderContents.find('*[class=""]').removeAttr('class');
    Mautic.builderContents = Mautic.clearFroalaStyles(Mautic.builderContents);
    Mautic.builderContents.find('*[style="z-index: 2501;"]').removeAttr('style');
    Mautic.builderContents.find('.fr-toolbar, .fr-line-breaker').remove();
    var htmlTags = document.getElementsByTagName('html');
    htmlTags[0].removeAttribute('class');
};
Mautic.clearFroalaStyles = function(content) {
    mQuery.each(content.find('td, th, table, [fr-original-class], [fr-original-style]'), function() {
        var el = mQuery(this);
        if (el.attr('fr-original-class')) {
            el.attr('class', el.attr('fr-original-class'));
            el.removeAttr('fr-original-class');
        }
        if (el.attr('fr-original-style')) {
            el.attr('style', el.attr('fr-original-style'));
            el.removeAttr('fr-original-style');
        }
        if (el.css('border') === '1px solid rgb(221, 221, 221)') {
            el.css('border', '');
        }
    });
    content.find('link[href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.4.0/css/font-awesome.min.css"]').remove();
    content.find('strong[contenteditable="false"]').removeAttr('style');
    content.find('[data-atwho-at-query]').removeAttr('data-atwho-at-query');
    return content;
}
Mautic.toggleBuilderButton = function(hide) {
    if (mQuery('.toolbar-form-buttons .toolbar-standard .btn-builder')) {
        if (hide) {
            mQuery('.toolbar-form-buttons .toolbar-standard .btn-builder').addClass('hide btn-standard-toolbar').appendTo('.toolbar-form-buttons')
            mQuery('.toolbar-form-buttons .toolbar-dropdown i.fa-cube').parent().addClass('hide');
        } else {
            if (!mQuery('.btn-standard-toolbar.btn-builder').length) {
                mQuery('.toolbar-form-buttons .toolbar-standard .btn-builder').addClass('btn-standard-toolbar')
            } else {
                mQuery('.toolbar-form-buttons .btn-standard-toolbar.btn-builder').prependTo('.toolbar-form-buttons .toolbar-standard').removeClass('hide');
                mQuery('.toolbar-form-buttons .toolbar-dropdown i.fa-cube').parent().removeClass('hide');
            }
        }
    }
};
Mautic.initSectionListeners = function() {
    Mautic.activateGlobalFroalaOptions();
    Mautic.selectedSlot = null;
    Mautic.builderContents.on('section:init', function(event, section, isNew) {
        section = mQuery(section);
        if (isNew) {
            Mautic.initSlots(section.find('[data-slot-container]'));
        }
        section.on('click', function(e) {
            var clickedSection = mQuery(this);
            var previouslyFocused = Mautic.builderContents.find('[data-section-focus]');
            var sectionWrapper = mQuery(this);
            var section = sectionWrapper.find('[data-section]');
            var focusParts = {
                'top': {},
                'right': {},
                'bottom': {},
                'left': {},
                'clone': {
                    classes: 'fa fa-copy',
                    onClick: function() {
                        var cloneBtn = mQuery(this);
                        var clonedElem = cloneBtn.closest('[data-section-wrapper]');
                        clonedElem.clone().insertAfter(clonedElem);
                        Mautic.initSlotListeners();
                        Mautic.initSections();
                        Mautic.initSlots();
                    }
                },
                'handle': {
                    classes: 'fa fa-arrows-v'
                },
                'delete': {
                    classes: 'fa fa-remove',
                    onClick: function() {
                        if (confirm(parent.Mautic.translate('mautic.core.builder.section_delete_warning'))) {
                            var deleteBtn = mQuery(this);
                            var focusSeciton = deleteBtn.closest('[data-section-wrapper]').remove();
                        }
                    }
                }
            };
            var sectionForm = mQuery(parent.mQuery('script[data-section-form]').html());
            var sectionFormContainer = parent.mQuery('#section-form-container');
            if (previouslyFocused.length) {
                previouslyFocused.remove();
                sectionFormContainer.find('input[data-toggle="color"]').each(function() {
                    mQuery(this).minicolors('destroy');
                });
            }
            Mautic.builderContents.find('[data-slot-focus]').each(function() {
                if (!mQuery(e.target).attr('data-slot-focus') && !mQuery(e.target).closest('data-slot').length && !mQuery(e.target).closest('[data-slot-container]').length) {
                    mQuery(this).remove();
                }
            });
            mQuery.each(focusParts, function(key, config) {
                var focusPart = mQuery('<div/>').attr('data-section-focus', key).addClass(config.classes);
                if (config.onClick) {
                    focusPart.on('click', config.onClick);
                }
                sectionWrapper.append(focusPart);
            });
            sectionFormContainer.html(sectionForm);
            if (section.length && section.css('background-color') !== 'rgba(0, 0, 0, 0)') {
                sectionForm.find('#builder_section_content-background-color').val(Mautic.rgb2hex(section.css('backgroundColor')));
            }
            if (sectionWrapper.css('background-color') !== 'rgba(0, 0, 0, 0)') {
                sectionForm.find('#builder_section_wrapper-background-color').val(Mautic.rgb2hex(sectionWrapper.css('backgroundColor')));
            }
            if (bgImage = sectionWrapper.css('background-image')) {
                sectionForm.find('#builder_section_wrapper-background-image').val(bgImage.replace(/url\((?:'|")(.+)(?:'|")\)/g, '$1'));
            }
            if (bgSize = sectionWrapper.css('background-size')) {
                sectionForm.find('#builder_section_wrapper-background-size').val(bgSize || 'auto auto');
            }
            if (bgRepeat = sectionWrapper.css('background-repeat')) {
                sectionForm.find('#builder_section_wrapper-background-repeat').val(bgRepeat);
            }
            sectionFormContainer.find('input[data-toggle="color"]').each(function() {
                parent.Mautic.activateColorPicker(this);
            });
            sectionForm.on('keyup paste change touchmove', function(e) {
                var field = mQuery(e.target);
                switch (field.attr('id')) {
                    case 'builder_section_content-background-color':
                        Mautic.sectionBackgroundChanged(section, field.val());
                        break;
                    case 'builder_section_wrapper-background-color':
                        Mautic.sectionBackgroundChanged(sectionWrapper, field.val());
                        break;
                    case 'builder_section_wrapper-background-image':
                        Mautic.sectionBackgroundImageChanged(sectionWrapper, field.val());
                        break;
                    case 'builder_section_wrapper-background-repeat':
                        sectionWrapper.css('background-repeat', field.val());
                        break;
                    case 'builder_section_wrapper-background-size':
                        Mautic.sectionBackgroundSize(sectionWrapper, field.val());
                        break;
                }
            });
            parent.mQuery('#section-form-container').on('change.minicolors', function(e, hex) {
                var field = mQuery(e.target);
                var focusedSectionWrapper = mQuery('[data-section-focus]').parent();
                var focusedSection = focusedSectionWrapper.find('[data-section]');
                if (focusedSection.length && field.attr('id') === 'builder_section_content-background-color') {
                    Mautic.sectionBackgroundChanged(focusedSection, field.val());
                } else if (field.attr('id') === 'builder_section_wrapper-background-color') {
                    Mautic.sectionBackgroundChanged(focusedSectionWrapper, field.val());
                }
            });
        });
    });
};
Mautic.initSections = function() {
    Mautic.initSectionListeners();
    var sectionWrappers = Mautic.builderContents.find('[data-section-wrapper]');
    var bodyOverflow = {};
    Mautic.sortActive = false;
    mQuery('body').sortable({
        helper: function(e, ui) {
            bodyOverflow.overflowX = mQuery('body').css('overflow-x');
            bodyOverflow.overflowY = mQuery('body').css('overflow-y');
            mQuery('body').css({
                overflowX: 'visible',
                overflowY: 'visible'
            });
            return ui;
        },
        axis: 'y',
        items: '[data-section-wrapper]',
        handle: '[data-section-focus="handle"]',
        placeholder: 'slot-placeholder',
        connectWith: 'body',
        start: function(event, ui) {
            Mautic.sortActive = true;
            ui.placeholder.height(ui.helper.outerHeight());
        },
        stop: function(event, ui) {
            if (ui.item.hasClass('section-type-handle')) {
                mQuery('body', parent.document).css(bodyOverflow);
                var newSection = mQuery('<div/>').attr('data-section-wrapper', ui.item.attr('data-section-type')).html(ui.item.find('script').html());
                ui.item.replaceWith(newSection);
                Mautic.builderContents.trigger('section:init', [newSection, true]);
            } else {
                mQuery('body').css(bodyOverflow);
            }
            Mautic.sortActive = false;
        },
    });
    var iframe = mQuery('#builder-template-content', parent.document).contents();
    mQuery('#section-type-container .section-type-handle', parent.document).draggable({
        iframeFix: true,
        connectToSortable: 'body',
        revert: 'invalid',
        iframeOffset: iframe.jQuery2Offset(),
        helper: function(e, ui) {
            bodyOverflow.overflowX = mQuery('body', parent.document).css('overflow-x');
            bodyOverflow.overflowY = mQuery('body', parent.document).css('overflow-y');
            mQuery('body', parent.document).css({
                overflowX: 'hidden',
                overflowY: 'hidden'
            });
            var helper = mQuery(this).clone().css('height', mQuery(this).height()).css('width', mQuery(this).width());
            return helper;
        },
        zIndex: 8000,
        cursorAt: {
            top: 15,
            left: 15
        },
        start: function(event, ui) {
            mQuery('#builder-template-content', parent.document).css('overflow', 'hidden');
            mQuery('#builder-template-content', parent.document).attr('scrolling', 'no');
        },
        stop: function(event, ui) {
            mQuery('body', parent.document).css(bodyOverflow);
            mQuery('#builder-template-content', parent.document).css('overflow', 'visible');
            mQuery('#builder-template-content', parent.document).attr('scrolling', 'yes');
        }
    }).disableSelection();
    sectionWrappers.each(function() {
        mQuery(this).trigger('section:init', this);
    });
};
Mautic.sectionBackgroundChanged = function(element, color) {
    if (color.length) {
        color = '#' + color;
    } else {
        color = 'transparent';
    }
    element.css('background-color', color).attr('bgcolor', color);
    mQuery(element).find('[data-slot-focus]').each(function() {
        var focusedSlot = mQuery(this).closest('[data-slot]');
        if (focusedSlot.attr('data-slot') == 'text') {
            Mautic.setTextSlotEditorStyle(parent.mQuery('#slot_text_content'), focusedSlot);
        }
    });
};
Mautic.sectionBackgroundImageChanged = function(element, imageUrl) {
    var regWrappedInUrl = /url\(.+\)/g;
    var match = regWrappedInUrl.exec(imageUrl);
    if (!imageUrl || imageUrl === 'none') {
        element.css('background-image', imageUrl);
    } else if (match) {
        element.css('background-image', imageUrl);
    } else {
        element.css('background-image', "url(" + imageUrl + ")");
    }
};
Mautic.sectionBackgroundSize = function(element, size) {
    if (!size) {
        size = 'auto auto';
    }
    element.css('background-size', size);
};
Mautic.rgb2hex = function(orig) {
    var rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+)/i);
    return (rgb && rgb.length === 4) ? "#" +
        ("0" + parseInt(rgb[1], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[2], 10).toString(16)).slice(-2) +
        ("0" + parseInt(rgb[3], 10).toString(16)).slice(-2) : orig;
};
Mautic.initSlots = function(slotContainers) {
    if (!slotContainers) {
        slotContainers = Mautic.builderContents.find('[data-slot-container]');
    }
    Mautic.builderContents.find('a').on('click', function(e) {
        e.preventDefault();
    });
    var bodyOverflow = {};
    Mautic.sortActive = false;
    Mautic.parentDocument = parent.document;
    slotContainers.sortable({
        helper: function(e, ui) {
            bodyOverflow.overflowX = mQuery('body').css('overflow-x');
            bodyOverflow.overflowY = mQuery('body').css('overflow-y');
            mQuery('body').css({
                overflowX: 'visible',
                overflowY: 'visible'
            });
            return ui;
        },
        items: '[data-slot]',
        handle: '[data-slot-toolbar]',
        placeholder: 'slot-placeholder',
        connectWith: '[data-slot-container]',
        start: function(event, ui) {
            Mautic.sortActive = true;
            ui.placeholder.height(ui.helper.outerHeight());
            Mautic.builderContents.find('[data-slot-focus]').each(function() {
                var focusedSlot = mQuery(this).closest('[data-slot]');
                if (focusedSlot.attr('data-slot') === 'image') {
                    focusedSlot.find('img').each(function() {
                        mQuery(this).froalaEditor('popups.hideAll');
                    });
                    Mautic.builderContents.find('.fr-image-resizer.fr-active').removeClass('fr-active');
                }
            });
            Mautic.builderContents.find('[data-slot-focus]').remove();
        },
        stop: function(event, ui) {
            if (ui.item.hasClass('slot-type-handle')) {
                mQuery('body', parent.document).css(bodyOverflow);
                var newSlot = mQuery('<div/>').attr('data-slot', ui.item.attr('data-slot-type')).html(ui.item.find('script').html())
                ui.item.replaceWith(newSlot);
                Mautic.builderContents.trigger('slot:init', newSlot);
            } else {
                mQuery('body').css(bodyOverflow);
            }
            Mautic.sortActive = false;
        }
    });
    var iframe = mQuery('#builder-template-content', parent.document).contents();
    mQuery('#slot-type-container .slot-type-handle', parent.document).draggable({
        iframeFix: true,
        connectToSortable: '[data-slot-container]',
        revert: 'invalid',
        iframeOffset: iframe.jQuery2Offset(),
        helper: function(e, ui) {
            bodyOverflow.overflowX = mQuery('body', Mautic.parentDocument).css('overflow-x');
            bodyOverflow.overflowY = mQuery('body', Mautic.parentDocument).css('overflow-y');
            mQuery('body', Mautic.parentDocument).css({
                overflowX: 'hidden',
                overflowY: 'hidden'
            });
            return mQuery(this).clone().css('height', mQuery(this).height()).css('width', mQuery(this).width());
        },
        zIndex: 8000,
        cursorAt: {
            top: 15,
            left: 15
        },
        start: function(event, ui) {
            mQuery('#builder-template-content', Mautic.parentDocument).css('overflow', 'hidden');
            mQuery('#builder-template-content', Mautic.parentDocument).attr('scrolling', 'no');
            if (slotContainers.data('sortable')) slotContainers.sortable('option', 'scroll', false);
        },
        stop: function(event, ui) {
            mQuery('body', Mautic.parentDocument).css(bodyOverflow);
            mQuery('#builder-template-content', Mautic.parentDocument).css('overflow', 'visible');
            mQuery('#builder-template-content', Mautic.parentDocument).attr('scrolling', 'yes');
            if (slotContainers.data('sortable')) slotContainers.sortable('option', 'scroll', true);
            parent.mQuery('.ui-draggable-dragging').remove();
        }
    }).disableSelection();
    iframe.on('scroll', function() {
        mQuery('#slot-type-container .slot-type-handle', Mautic.parentDocument).draggable("option", "cursorAt", {
            top: -1 * iframe.scrollTop() + 15
        });
    });
    slotContainers.find('[data-slot]').each(function() {
        mQuery(this).trigger('slot:init', this);
    });
};
Mautic.getSlotToolbar = function(type) {
    Mautic.builderContents.find('[data-slot-toolbar]').remove();
    var slotToolbar = mQuery('<div/>').attr('data-slot-toolbar', true);
    var deleteLink = Mautic.getSlotDeleteLink();
    var cloneLink = Mautic.getSlotCloneLink();
    if (typeof type !== 'undefined') {
        mQuery('<span style="color:#fff;margin-left:10px;font-family:sans-serif;font-size:smaller">' + type.toUpperCase() + '</span>').appendTo(slotToolbar);
    }
    deleteLink.appendTo(slotToolbar);
    cloneLink.appendTo(slotToolbar);
    return slotToolbar;
};
Mautic.getSlotDeleteLink = function() {
    if (typeof Mautic.deleteLink == 'undefined') {
        Mautic.deleteLink = mQuery('<a><i class="fa fa-lg fa-times"></i></a>').attr('data-slot-action', 'delete').attr('alt', 'delete').addClass('btn btn-delete btn-default');
    }
    return Mautic.deleteLink;
};
Mautic.getSlotCloneLink = function() {
    if (typeof Mautic.cloneLink == 'undefined') {
        Mautic.cloneLink = mQuery('<a><i class="fa fa-lg fa-copy"></i></a>').attr('data-slot-action', 'clone').attr('alt', 'clone').addClass('btn btn-clone btn-clone');
    }
    return Mautic.cloneLink;
};
Mautic.getSlotFocus = function() {
    Mautic.builderContents.find('[data-slot-focus]').remove();
    return mQuery('<div/>').attr('data-slot-focus', true);
};
Mautic.cloneFocusForm = function(decId, removeFroala) {
    Mautic.reattachDEC();
    var focusForm = parent.mQuery('#emailform_dynamicContent_' + decId);
    Mautic.activeDECParent = focusForm.parent();
    focusForm.removeClass('fade');
    focusForm.find('.tab-pane:first').find('.remove-item').hide();
    focusForm.find('.addNewDynamicContentFilter').hide();
    var element = focusForm.detach();
    Mautic.activeDEC = element;
    return element;
};
Mautic.initEmailDynamicContentSlotEdit = function(clickedSlot) {
    var decId = clickedSlot.attr('data-param-dec-id');
    var focusForm;
    if (decId || decId === 0) {
        focusForm = Mautic.cloneFocusForm(decId);
    }
    var focusFormHeader = parent.mQuery('#customize-slot-panel').find('.panel-heading h4');
    var newDynConButton = mQuery('<button/>').css('float', 'right').addClass('btn btn-success btn-xs');
    newDynConButton.text('Add Variant');
    newDynConButton.on('click', function(e) {
        e.stopPropagation();
        Mautic.createNewDynamicContentFilter('#dynamicContentFilterTabs_' + decId, parent.mQuery);
        var focusForm = Mautic.cloneFocusForm(decId, false);
        focusForm.insertAfter(parent.mQuery('#slot_dynamiccontent > div.has-error'));
    });
    focusFormHeader.append(newDynConButton);
    return focusForm;
};
Mautic.removeAddVariantButton = function() {
    parent.mQuery('#customize-slot-panel').find('.panel-heading button').remove();
    Mautic.reattachDEC();
};
Mautic.reattachDEC = function() {
    if (typeof Mautic.activeDEC !== 'undefined') {
        var element = Mautic.activeDEC.detach();
        Mautic.activeDECParent.append(element);
    }
};
Mautic.isSlotInitiated = function(slot) {
    if (typeof Mautic.builderSlots === 'undefined' || Mautic.builderSlots.length === 0) return false;
    return typeof Mautic.builderSlots.find(function(params) {
        return slot.is(params.slot);
    }) !== 'undefined';
};
Mautic.isCodeMode = function() {
    return mQuery('a[data-theme=mautic_code_mode]').first().hasClass('hide');
};
window.document.fileManagerInsertImageCallback = function(selector, url) {
    if (Mautic.isCodeMode()) {
        Mautic.insertTextAtCMCursor(url);
    } else {
        if (typeof FroalaEditorForFileManager !== 'underfined') {
            if (typeof FroalaEditorForFileManagerCurrentImage !== 'undefined') {
                FroalaEditorForFileManager.image.insert(url, false, {}, FroalaEditorForFileManagerCurrentImage);
            } else {
                FroalaEditorForFileManager.image.insert(url);
            }
        } else {
            if (typeof FroalaEditorForFileManagerCurrentImage !== 'undefined') {
                mQuery(selector).froalaEditor('image.insert', url, false, {}, FroalaEditorForFileManagerCurrentImage);
            } else {
                mQuery(selector).froalaEditor('image.insert', url);
            }
        }
    }
};
Mautic.initSlotListeners = function() {
    Mautic.activateGlobalFroalaOptions();
    Mautic.builderSlots = [];
    Mautic.selectedSlot = null;
    Mautic.builderContents.on('slot:selected', function(event, slot) {
        slot = mQuery(slot);
        Mautic.builderContents.find('[data-slot-focus]').remove();
        mQuery(slot).append(Mautic.getSlotFocus());
    });
    Mautic.builderContents.on('slot:init', function(event, slot) {
        slot = mQuery(slot);
        var type = slot.attr('data-slot');
        if (Mautic.isSlotInitiated(slot)) return;
        var slotToolbar = Mautic.getSlotToolbar(type);
        var deleteLink = Mautic.getSlotDeleteLink();
        var cloneLink = Mautic.getSlotCloneLink();
        var focus = Mautic.getSlotFocus();
        slot.hover(function(e) {
            e.stopPropagation();
            slotToolbar = Mautic.getSlotToolbar(type);
            focus = Mautic.getSlotFocus();
            if (Mautic.sortActive) {
                return;
            }
            if (slot.html() == '') {
                slot.addClass('empty');
            } else {
                slot.removeClass('empty');
            }
            slot.append(focus);
            deleteLink.click(function(e) {
                if (type == 'dynamicContent') {
                    var dynConId = slot.attr('data-param-dec-id');
                    dynConId = '#emailform_dynamicContent_' + dynConId;
                    var dynConTarget = parent.mQuery(dynConId);
                    dynConTarget.find(dynConId + '_tokenName').val('');
                }
                slot.trigger('slot:destroy', {
                    slot: slot,
                    type: type
                });
                mQuery.each(Mautic.builderSlots, function(i, slotParams) {
                    if (slotParams.slot.is(slot)) {
                        Mautic.builderSlots.splice(i, 1);
                        return false;
                    }
                });
                slot.remove();
                focus.remove();
            });
            cloneLink.click(function(e) {
                if (type == 'dynamicContent') {
                    var maxId = Mautic.getDynamicContentMaxId();
                    slot.clone().attr('data-param-dec-id', maxId + 1).insertAfter(slot);
                    Mautic.createNewDynamicContentItem(parent.mQuery);
                } else {
                    slot.clone().insertAfter(slot);
                }
                Mautic.initSlots(slot.closest('[data-slot-container="1"]'));
            });
            if (slot.offset().top < 25) {
                slotToolbar.css('top', '0');
            } else {
                slotToolbar.css('top', '-24px');
            }
            slot.append(slotToolbar);
            Mautic.setEmptySlotPlaceholder(slot);
        }, function() {
            if (Mautic.sortActive) {
                return;
            }
            slotToolbar.remove();
            focus.remove();
        });
        slot.on('click', function(e) {
            e.stopPropagation();
            Mautic.deleteCodeModeSlot();
            Mautic.removeAddVariantButton();
            var clickedSlot = mQuery(this);
            clickedSlot.trigger('slot:selected', clickedSlot);
            var minicolors = parent.mQuery('#slot-form-container .minicolors');
            if (minicolors.length) {
                parent.mQuery('#slot-form-container input[data-toggle="color"]').each(function() {
                    mQuery(this).minicolors('destroy');
                });
                parent.mQuery('#slot-form-container').off('change.minicolors');
            }
            if (parent.mQuery('#slot-form-container').find('textarea.editor')) {
                parent.mQuery('#slot-form-container').find('textarea.editor').each(function() {
                    parent.mQuery(this).froalaEditor('popups.hideAll');
                });
            }
            var focusType = clickedSlot.attr('data-slot');
            var focusForm = mQuery(parent.mQuery('script[data-slot-type-form="' + focusType + '"]').html());
            var slotFormContainer = parent.mQuery('#slot-form-container');
            if (focusType == 'dynamicContent') {
                var nff = Mautic.initEmailDynamicContentSlotEdit(clickedSlot);
                nff.insertAfter(focusForm.find('#slot_dynamiccontent > div.has-error'));
            }
            slotFormContainer.html(focusForm);
            parent.mQuery.each(clickedSlot.get(0).attributes, function(i, attr) {
                var regex = /data-param-(.*)/;
                var match = regex.exec(attr.name);
                if (match !== null) {
                    focusForm.find('input[type="text"][data-slot-param="' + match[1] + '"]').val(attr.value);
                    var selectField = focusForm.find('select[data-slot-param="' + match[1] + '"]');
                    if (selectField.length) {
                        selectField.val(attr.value)
                    }
                    var urlField = focusForm.find('input[type="url"][data-slot-param="' + match[1] + '"]');
                    if (urlField.length) {
                        urlField.val(attr.value);
                    }
                    var numberField = focusForm.find('input[type="number"][data-slot-param="' + match[1] + '"]');
                    if (numberField.length) {
                        numberField.val(attr.value);
                    }
                    var radioField = focusForm.find('input[type="radio"][data-slot-param="' + match[1] + '"][value="' + attr.value + '"]');
                    if (radioField.length) {
                        radioField.parent('.btn').addClass('active');
                        radioField.attr('checked', true);
                    }
                }
            });
            focusForm.on('keyup change', function(e) {
                var field = mQuery(e.target);
                if (field.attr('data-slot-param')) {
                    clickedSlot.attr('data-param-' + field.attr('data-slot-param'), field.val());
                }
                clickedSlot.trigger('slot:change', {
                    slot: clickedSlot,
                    field: field,
                    type: focusType
                });
            });
            focusForm.find('.btn').on('click', function(e) {
                var field = mQuery(this).find('input:radio');
                if (field.length) {
                    clickedSlot.attr('data-param-' + field.attr('data-slot-param'), field.val());
                    clickedSlot.trigger('slot:change', {
                        slot: clickedSlot,
                        field: field,
                        type: focusType
                    });
                }
            });
            focusForm.find('input[data-toggle="color"]').each(function() {
                parent.Mautic.activateColorPicker(this, {
                    change: function() {
                        var field = mQuery(this);
                        clickedSlot.attr('data-param-' + field.attr('data-slot-param'), field.val());
                        clickedSlot.trigger('slot:change', {
                            slot: clickedSlot,
                            field: field,
                            type: focusType
                        });
                    }
                });
            });
            $codeModeSlotTypes = ['codemode'];
            for (var i = 0; i < $codeModeSlotTypes.length; i++) {
                if ($codeModeSlotTypes[i] === type) {
                    Mautic.codeMode = true;
                    var element = focusForm.find('#slot_' + $codeModeSlotTypes[i] + '_content')[0];
                    if (element) {
                        Mautic.builderCodeMirror = CodeMirror.fromTextArea(element, {
                            lineNumbers: true,
                            mode: 'htmlmixed',
                            extraKeys: {
                                "Ctrl-Space": "autocomplete"
                            },
                            lineWrapping: true,
                        });
                        var elem = slot.find('#codemodeHtmlContainer,.codemodeHtmlContainer');
                        html = Mautic.geCodeModetSlotContent(elem);
                        Mautic.builderCodeMirror.getDoc().setValue(html);
                        Mautic.keepPreviewAlive(null, elem);
                    }
                    break;
                }
            }
            focusForm.find('textarea.editor').each(function() {
                var theEditor = this;
                var slotHtml = parent.mQuery('<div/>').html(clickedSlot.html());
                slotHtml.find('[data-slot-focus]').remove();
                slotHtml.find('[data-slot-toolbar]').remove();
                var buttons = ['undo', 'redo', '|', 'bold', 'italic', 'underline', 'paragraphFormat', 'fontFamily', 'fontSize', 'color', 'align', 'formatOL', 'formatUL', 'quote', 'clearFormatting', 'token', 'insertLink', 'insertImage', 'insertGatedVideo', 'insertTable', 'html', 'fullscreen'];
                var builderEl = parent.mQuery('.builder');
                var froalaOptions = {
                    toolbarButtons: buttons,
                    toolbarButtonsMD: buttons,
                    toolbarButtonsSM: buttons,
                    toolbarButtonsXS: buttons,
                    toolbarSticky: false,
                    linkList: [],
                    imageEditButtons: ['imageReplace', 'imageAlign', 'imageRemove', 'imageAlt', 'imageSize', '|', 'imageLink', 'linkOpen', 'linkEdit', 'linkRemove']
                };
                if (builderEl.length && builderEl.hasClass('email-builder')) {
                    buttons = parent.mQuery.grep(buttons, function(value) {
                        return value != 'insertGatedVideo';
                    });
                    froalaOptions.imageOutputSize = true;
                }
                if (focusType !== 'dynamicContent') {
                    parent.mQuery(this).on('froalaEditor.initialized', function(e, editor) {
                        parent.Mautic.initAtWho(editor.$el, parent.Mautic.getBuilderTokensMethod(), editor);
                        Mautic.setTextSlotEditorStyle(editor.$el, clickedSlot);
                    });
                }
                parent.mQuery(this).on('froalaEditor.contentChanged', function(e, editor) {
                    var slotHtml = mQuery('<div/>').append(editor.html.get());
                    if (!(focusType == 'dynamicContent' && mQuery(this).attr('id').match(/filters/))) {
                        clickedSlot.html(slotHtml.html());
                        Mautic.setEmptySlotPlaceholder(clickedSlot);
                    }
                });
                if (!(focusType == 'dynamicContent' && mQuery(this).attr('id').match(/filters/))) {
                    parent.mQuery(this).val(slotHtml.html());
                }
                parent.mQuery(this).froalaEditor(parent.mQuery.extend({}, Mautic.basicFroalaOptions, froalaOptions));
            });
        });
        if (type === 'image' || type === 'imagecaption' || type === 'imagecard') {
            var image = slot.find('img');
            image.removeAttr('data-froala.editor');
            image.on('froalaEditor.click', function(e, editor) {
                slot.closest('[data-slot]').trigger('click');
            });
            var froalaOptions = mQuery.extend({}, Mautic.basicFroalaOptions, {
                linkList: [],
                imageEditButtons: ['imageReplace', 'imageAlign', 'imageAlt', 'imageSize', '|', 'imageLink', 'linkOpen', 'linkEdit', 'linkRemove'],
                useClasses: false,
                imageOutputSize: true
            });
            image.froalaEditor(froalaOptions);
        } else if (type === 'button') {
            slot.find('a').click(function(e) {
                e.preventDefault();
            });
        } else if (type === 'dynamicContent') {
            if (slot.html().match(/__dynamicContent__/)) {
                var maxId = Mautic.getDynamicContentMaxId();
                slot.attr('data-param-dec-id', maxId + 1);
                slot.html('Dynamic Content');
                Mautic.createNewDynamicContentItem(parent.mQuery);
            }
        }
        Mautic.builderSlots.push({
            slot: slot,
            type: type
        });
    });
    Mautic.getPredefinedLinks = function(callback) {
        var linkList = [];
        Mautic.getTokens(Mautic.getBuilderTokensMethod(), function(tokens) {
            if (tokens.length) {
                mQuery.each(tokens, function(token, label) {
                    if (token.startsWith('{pagelink=') || token.startsWith('{assetlink=') || token.startsWith('{webview_url') || token.startsWith('{unsubscribe_url')) {
                        linkList.push({
                            text: label,
                            href: token
                        });
                    }
                });
            }
            return callback(linkList);
        });
    };
    Mautic.builderContents.on('slot:change', function(event, params) {
        var fieldParam = params.field.attr('data-slot-param');
        var type = params.type;
        if (type !== "dynamicContent") {
            Mautic.removeAddVariantButton();
        }
        Mautic.clearSlotFormError(fieldParam);
        if (fieldParam === 'padding-top' || fieldParam === 'padding-bottom') {
            params.slot.css(fieldParam, params.field.val() + 'px');
        } else if ('label-text' === fieldParam) {
            params.slot.find('label.control-label').text(params.field.val());
        } else if ('label-text1' === fieldParam) {
            params.slot.find('label.label1').text(params.field.val());
        } else if ('label-text2' === fieldParam) {
            params.slot.find('label.label2').text(params.field.val());
        } else if ('label-text3' === fieldParam) {
            params.slot.find('label.label3').text(params.field.val());
        } else if ('label-text4' === fieldParam) {
            params.slot.find('label.label4').text(params.field.val());
        } else if ('flink' === fieldParam || 'tlink' === fieldParam) {
            params.slot.find('#' + fieldParam).attr('href', params.field.val());
        } else if (fieldParam === 'href') {
            params.slot.find('a').eq(0).attr('href', params.field.val());
        } else if (fieldParam === 'link-text') {
            params.slot.find('a').eq(0).text(params.field.val());
        } else if (fieldParam === 'float') {
            var values = ['left', 'center', 'right'];
            params.slot.find('a').parent().attr('align', values[params.field.val()]);
        } else if (fieldParam === 'caption') {
            params.slot.find('figcaption').text(params.field.val());
        } else if (fieldParam === 'cardcaption') {
            params.slot.find('td.imagecard-caption').text(params.field.val());
        } else if (fieldParam === 'text-align') {
            var values = ['left', 'center', 'right'];
            if (type === 'imagecard') {
                params.slot.find('.imagecard-caption').css(fieldParam, values[params.field.val()]);
            } else if (type === 'imagecaption') {
                params.slot.find('figcaption').css(fieldParam, values[params.field.val()]);
            }
        } else if (fieldParam === 'align') {
            Mautic.builderContents.find('[data-slot-focus]').each(function() {
                var focusedSlot = mQuery(this).closest('[data-slot]');
                if (focusedSlot.attr('data-slot') == 'image') {
                    focusedSlot.find('img').each(function() {
                        mQuery(this).froalaEditor('popups.hideAll');
                    });
                    Mautic.builderContents.find('.fr-image-resizer.fr-active').removeClass('fr-active');
                }
            });
            var values = ['left', 'center', 'right'];
            if ('socialfollow' === type) {
                params.slot.find('div.socialfollow').css('text-align', values[params.field.val()]);
            } else if ('imagecaption' === type) {
                params.slot.find('figure').css('text-align', values[params.field.val()]);
            } else if ('imagecard' === type) {
                params.slot.find('td.imagecard-image').css('text-align', values[params.field.val()]);
            } else {
                params.slot.find('img').closest('div').css('text-align', values[params.field.val()]);
            }
        } else if (fieldParam === 'border-radius') {
            params.slot.find('a.button').css(fieldParam, params.field.val() + 'px');
        } else if (fieldParam === 'button-size') {
            var bg_clr = params.slot.attr('data-param-background-color');
            var values = [{
                borderWidth: '10px 20px',
                padding: '0',
                fontSize: '14px',
                borderColor: bg_clr,
                borderStyle: 'solid'
            }, {
                borderWidth: '20px 23px',
                padding: '0',
                fontSize: '20px',
                borderColor: bg_clr,
                borderStyle: 'solid'
            }, {
                borderWidth: '25px 40px',
                padding: '0',
                fontSize: '30px',
                borderColor: bg_clr,
                borderStyle: 'solid'
            }];
            params.slot.find('a.button').css(values[params.field.val()]);
        } else if (fieldParam === 'caption-color') {
            params.slot.find('.imagecard-caption').css('background-color', '#' + params.field.val());
        } else if (fieldParam === 'background-color' || fieldParam === 'color') {
            var matches = params.field.val().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/);
            if (matches !== null) {
                var color = matches[1];
                if (fieldParam === 'background-color') {
                    if ('imagecard' === type) {
                        params.slot.find('.imagecard').css(fieldParam, '#' + color);
                    } else {
                        params.slot.find('a.button').css(fieldParam, '#' + color);
                        params.slot.find('a.button').attr('background', '#' + color);
                        params.slot.find('a.button').css('border-color', '#' + color);
                    }
                } else if (fieldParam === 'color') {
                    if ('imagecard' === type) {
                        params.slot.find('.imagecard-caption').css(fieldParam, '#' + color);
                    } else if ('imagecaption' === type) {
                        params.slot.find('figcaption').css(fieldParam, '#' + color);
                    } else {
                        params.slot.find('a.button').css(fieldParam, '#' + color);
                    }
                }
            }
        } else if (/gatedvideo/.test(fieldParam)) {
            var toInsert = fieldParam.split('-')[1];
            var insertVal = params.field.val();
            if (toInsert === 'url') {
                var videoProvider = Mautic.getVideoProvider(insertVal);
                if (videoProvider == null) {
                    Mautic.slotFormError(fieldParam, 'Please enter a valid YouTube, Vimeo, or MP4 url.');
                } else {
                    params.slot.find('source').attr('src', insertVal).attr('type', videoProvider);
                }
            } else if (toInsert === 'gatetime') {
                params.slot.find('video').attr('data-gate-time', insertVal);
            } else if (toInsert === 'formid') {
                params.slot.find('video').attr('data-form-id', insertVal);
            } else if (toInsert === 'height') {
                params.slot.find('video').attr('height', insertVal);
            } else if (toInsert === 'width') {
                params.slot.find('video').attr('width', insertVal);
            }
        } else if (fieldParam === 'separator-color') {
            params.slot.find('hr').css('border-color', '#' + params.field.val());
        } else if (fieldParam === 'separator-thickness') {
            var sep_color = params.slot.attr('data-param-separator-color');
            params.slot.find('hr').css('border', params.field.val() + 'px solid #' + sep_color);
        }
        if (params.type == 'text') {
            Mautic.setTextSlotEditorStyle(parent.mQuery('#slot_text_content'), params.slot);
        }
    });
    Mautic.builderContents.on('slot:destroy', function(event, params) {
        Mautic.reattachDEC();
        if (params.type === 'text') {
            if (parent.mQuery('#slot_text_content').length) {
                parent.mQuery('#slot_text_content').froalaEditor('destroy');
                parent.mQuery('#slot_text_content').find('.atwho-inserted').atwho('destroy');
            }
        } else if (params.type === 'image') {
            Mautic.deleteCodeModeSlot();
            var image = params.slot.find('img');
            if (typeof image !== 'undefined' && image.hasClass('fr-view')) {
                image.froalaEditor('destroy');
                image.removeAttr('data-froala.editor');
                image.removeClass('fr-view');
            }
        } else if (params.type === 'dynamicContent') {
            Mautic.removeAddVariantButton();
            var dynConId = params.slot.attr('data-param-dec-id');
            dynConId = '#emailform_dynamicContent_' + dynConId;
            if (Mautic.activeDEC && Mautic.activeDEC.attr('id') === dynConId.substr(1)) {
                delete Mautic.activeDEC;
                delete Mautic.activeDECParent;
            }
            var dynConTarget = parent.mQuery(dynConId);
            var dynConName = dynConTarget.find(dynConId + '_tokenName').val();
            if (dynConName === '') {
                dynConTarget.find('a.remove-item:first').click();
                parent.mQuery('.dynamicContentFilterContainer').find('a[href=' + dynConId + ']').parent().remove();
                params.slot.remove();
            }
        }
        Mautic.builderContents.find('.sf-toolbar').remove();
    });
};
Mautic.deleteCodeModeSlot = function() {
    Mautic.killLivePreview();
    Mautic.destroyCodeMirror();
    delete Mautic.codeMode;
};
Mautic.clearSlotFormError = function(field) {
    var customizeSlotField = parent.mQuery('#customize-form-container').find('[data-slot-param="' + field + '"]');
    if (customizeSlotField.length) {
        customizeSlotField.attr('style', '');
        customizeSlotField.next('[data-error]').remove();
    }
};
Mautic.slotFormError = function(field, message) {
    var customizeSlotField = parent.mQuery('#customize-form-container').find('[data-slot-param="' + field + '"]');
    if (customizeSlotField.length) {
        customizeSlotField.css('border-color', 'red');
        if (message.length) {
            var messageContainer = mQuery('<p/>').text(message).attr('data-error', 'true').css({
                color: 'red',
                padding: '5px 0'
            });
            messageContainer.insertAfter(customizeSlotField);
        }
    }
};
Mautic.getVideoProvider = function(url) {
    var providers = [{
        test_regex: /^.*((youtu.be)|(youtube.com))\/((v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))?\??v?=?([^#\&\?]*).*/,
        provider: 'video/youtube'
    }, {
        test_regex: /^.*(vimeo\.com\/)((channels\/[A-z]+\/)|(groups\/[A-z]+\/videos\/))?([0-9]+)/,
        provider: 'video/vimeo'
    }, {
        test_regex: /mp4/,
        provider: 'video/mp4'
    }];
    for (var i = 0; i < providers.length; i++) {
        var vp = providers[i];
        if (vp.test_regex.test(url)) {
            return vp.provider;
        }
    }
    return null;
};
Mautic.setTextSlotEditorStyle = function(editorEl, slot) {
    var wrapper = parent.mQuery(editorEl).closest('.form-group').find('.fr-wrapper .fr-element').first();
    if (typeof wrapper == 'undefined') {
        return;
    }
    if (typeof slot.attr('style') !== 'undefined') {
        wrapper.attr('style', slot.attr('style'));
    }
    mQuery.each(['background-color', 'color', 'font-family', 'font-size', 'line-height', 'text-align'], function(key, style) {
        var overrideStyle = Mautic.getSlotStyle(slot, style, false);
        if (overrideStyle) {
            wrapper.css(style, overrideStyle);
        }
    });
};
Mautic.getSlotStyle = function(slot, styleName, fallback) {
    if ('background-color' == styleName) {
        var temp = mQuery('<div style="background:none;display:none;"/>').appendTo('body');
        var transparent = temp.css(styleName);
        temp.remove();
    }
    var findStyle = function(slot) {
        function test(elem) {
            if ('background-color' == styleName) {
                if (typeof elem.attr('bgcolor') !== 'undefined') {
                    return elem.attr('bgcolor');
                }
                if (elem.css(styleName) == transparent) {
                    return !elem.is('body') ? test(elem.parent()) : fallback || transparent;
                } else {
                    return elem.css(styleName);
                }
            } else if (typeof elem.css(styleName) !== 'undefined') {
                return elem.css(styleName);
            } else {
                return !elem.is('body') ? test(elem.parent()) : fallback;
            }
        }
        return test(slot);
    };
    return findStyle(slot);
};
Mautic.getBuilderTokensMethod = function() {
    var method = 'page:getBuilderTokens';
    if (parent.mQuery('.builder').hasClass('email-builder')) {
        method = 'email:getBuilderTokens';
    }
    return method;
};
Mautic.prepareBuilderIframe = function(themeHtml, btnCloseBuilder, applyBtn) {
    var decTokenRegex = /(?:{)dynamiccontent="(.*?)(?:")}/g;
    var match = decTokenRegex.exec(themeHtml);
    while (match !== null) {
        var dynConToken = match[0];
        var dynConName = match[1];
        if (!Mautic.builderTokens.hasOwnProperty(dynConToken)) {
            Mautic.builderTokens[dynConToken] = dynConName;
        }
        match = decTokenRegex.exec(themeHtml);
    }
    themeHtml = Mautic.prepareDynamicContentBlocksForBuilder(themeHtml);
    var isPrefCenterEnabled = eval(parent.mQuery('input[name="page[isPreferenceCenter]"]:checked').val());
    if (!isPrefCenterEnabled) {
        var slots = ['segmentlist', 'categorylist', 'preferredchannel', 'channelfrequency', 'saveprefsbutton', 'successmessage'];
        mQuery.each(slots, function(i, s) {
            themeHtml = themeHtml.replace('{' + s + '}', '');
        });
        var parser = new DOMParser();
        var el = parser.parseFromString(themeHtml, "text/html");
        var $b = mQuery(el);
        mQuery.each(slots, function(i, s) {
            $b.find('[data-slot=' + s + ']').remove();
        });
        themeHtml = Mautic.domToString($b);
    }
    Mautic.buildBuilderIframe(themeHtml, 'builder-template-content', function() {
        mQuery('#builder-overlay').addClass('hide');
        btnCloseBuilder.prop('disabled', false);
        applyBtn.prop('disabled', false);
    });
};
Mautic.initBuilderIframe = function(themeHtml, btnCloseBuilder, applyBtn) {
    if (Mautic.builderTokensRequestInProgress) {
        var intervalID = setInterval(function() {
            if (!Mautic.builderTokensRequestInProgress) {
                clearInterval(intervalID);
                Mautic.prepareBuilderIframe(themeHtml, btnCloseBuilder, applyBtn);
            }
        }, 500);
    } else {
        Mautic.prepareBuilderIframe(themeHtml, btnCloseBuilder, applyBtn);
    }
};
Mautic.prepareDynamicContentBlocksForBuilder = function(builderHtml) {
    for (var token in Mautic.builderTokens) {
        if (Mautic.builderTokens.hasOwnProperty(token) && /\{dynamic/.test(token)) {
            var defaultContent = Mautic.convertDynamicContentTokenToSlot(token);
            builderHtml = builderHtml.replace(token, defaultContent);
        }
    }
    return builderHtml;
};
Mautic.convertDynamicContentTokenToSlot = function(token) {
    var dynConData = Mautic.getDynamicContentDataForToken(token);
    if (dynConData) {
        return '<div data-slot="dynamicContent" contenteditable="false" data-param-dec-id="' + dynConData.id + '">' + dynConData.content + '</div>';
    }
    return token;
};
Mautic.getDynamicContentDataForToken = function(token) {
    var dynConName = /\{dynamiccontent="(.*)"\}/.exec(token)[1];
    var dynConTabs = parent.mQuery('#dynamicContentTabs');
    var dynConTarget = dynConTabs.find('a:contains("' + dynConName + '")').attr('href');
    var dynConContainer = parent.mQuery(dynConTarget);
    if (dynConContainer.html()) {
        var dynConContent = dynConContainer.find(dynConTarget + '_content');
        if (dynConContent.hasClass('editor')) {
            dynConContent = dynConContent.froalaEditor('html.get');
        } else {
            dynConContent = dynConContent.html();
        }
        return {
            id: parseInt(dynConTarget.replace(/[^0-9]/g, '')),
            content: dynConContent
        };
    }
    return null;
};
Mautic.convertDynamicContentSlotsToTokens = function(builderHtml) {
    var dynConSlots = mQuery(builderHtml).find('[data-slot="dynamicContent"]');
    if (dynConSlots.length) {
        dynConSlots.each(function(i) {
            var $this = mQuery(this);
            var dynConNum = $this.attr('data-param-dec-id');
            var dynConId = '#emailform_dynamicContent_' + dynConNum;
            var dynConTarget = mQuery(dynConId);
            var dynConName = dynConTarget.find(dynConId + '_tokenName').val();
            var dynConToken = '{dynamiccontent="' + dynConName + '"}';
            if (!Mautic.builderTokens.hasOwnProperty(dynConToken)) {
                Mautic.builderTokens[dynConToken] = dynConName;
            }
            var parser = new DOMParser();
            var el = parser.parseFromString(builderHtml, "text/html");
            var $b = mQuery(el);
            $b.find('div[data-param-dec-id=' + dynConNum + ']').replaceWith(dynConToken);
            builderHtml = Mautic.domToString($b);
            if ($this.parent().hasClass('atwho-inserted')) {
                var toReplace = $this.parent('.atwho-inserted').get(0).outerHTML;
                builderHtml = builderHtml.replace(toReplace, dynConToken);
            }
        });
    }
    return builderHtml;
};
Mautic.getPredefinedLinks = function(callback) {
    var linkList = [];
    Mautic.getTokens(Mautic.getBuilderTokensMethod(), function(tokens) {
        if (tokens.length) {
            mQuery.each(tokens, function(token, label) {
                if (token.startsWith('{pagelink=') || token.startsWith('{assetlink=') || token.startsWith('{webview_url') || token.startsWith('{unsubscribe_url')) {
                    linkList.push({
                        text: label,
                        href: token
                    });
                }
            });
        }
        return callback(linkList);
    });
};
Mautic.getDynamicContentMaxId = function() {
    var decs = mQuery('[data-slot="dynamicContent"]');
    var ids = mQuery.map(decs, function(e) {
        return mQuery(e).attr('data-param-dec-id');
    });
    var maxId = Math.max.apply(Math, ids);
    if (isNaN(maxId) || Number.NEGATIVE_INFINITY === maxId) maxId = 0;
    return maxId;
};
Mautic.setEmptySlotPlaceholder = function(slot) {
    var clonedSlot = slot.clone();
    clonedSlot.find('div[data-slot-focus="true"]').remove()
    clonedSlot.find('div[data-slot-toolbar="true"]').remove()
    if ((clonedSlot.text()).trim() == '' && !clonedSlot.find('img').length) {
        slot.addClass('empty');
    } else {
        slot.removeClass('empty');
    }
};
mQuery(function() {
    if (parent && parent.mQuery && parent.mQuery('#builder-template-content').length) {
        Mautic.builderContents = mQuery('body');
        if (!parent.Mautic.codeMode) {
            Mautic.initSlotListeners();
            Mautic.initSections();
            Mautic.initSlots();
        }
    }
});;
Mautic.getAbTestWinnerForm = function(bundle, formName, abKey) {
    if (abKey && mQuery(abKey).val() && mQuery(abKey).closest('.form-group').hasClass('has-error')) {
        mQuery(abKey).closest('.form-group').removeClass('has-error');
        if (mQuery(abKey).next().hasClass('help-block')) {
            mQuery(abKey).next().remove();
        }
    }
    Mautic.activateLabelLoadingIndicator(formName + '_variantSettings_winnerCriteria');
    var id = mQuery('#' + formName + '_sessionId').val();
    var query = "action=" + bundle + ":getAbTestForm&abKey=" + mQuery(abKey).val() + "&id=" + id;
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            if (typeof response.html != 'undefined') {
                if (mQuery('#' + formName + '_variantSettings_properties').length) {
                    mQuery('#' + formName + '_variantSettings_properties').replaceWith(response.html);
                } else {
                    mQuery('#' + formName + '_variantSettings').append(response.html);
                }
                if (response.html != '') {
                    Mautic.onPageLoad('#' + formName + '_variantSettings_properties', response);
                }
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            Mautic.removeLabelLoadingIndicator();
        }
    });
};;
mQuery(document).on({
    "chosen:hiding_dropdown": function() {
        mQuery('#app-wrapper').css('overflow', 'hidden');
    },
    "chosen:showing_dropdown": function() {
        mQuery('#app-wrapper').css('overflow', 'visible');
    }
});
Mautic.renameFormElements = function(container, oldIdPrefix, oldNamePrefix, newIdPrefix, newNamePrefix) {
    mQuery('*[id^="' + oldIdPrefix + '"]', container).each(function() {
        var id = mQuery(this).attr('id');
        id = id.replace(oldIdPrefix, newIdPrefix);
        mQuery(this).attr('id', id);
        var name = mQuery(this).attr('name');
        if (name) {
            name = name.replace(oldNamePrefix, newNamePrefix);
            mQuery(this).attr('name', name);
        }
    });
    mQuery('label[for^="' + oldIdPrefix + '"]', container).each(function() {
        var id = mQuery(this).attr('for');
        id = id.replace(oldIdPrefix, newIdPrefix);
        mQuery(this).attr('for', id);
    });
};
Mautic.ajaxifyForm = function(formName) {
    Mautic.initializeFormFieldVisibilitySwitcher(formName);
    var form = 'form[name="' + formName + '"]';
    mQuery(form + ' input, ' + form + ' select').off('keydown.ajaxform');
    mQuery(form + ' input, ' + form + ' select').on('keydown.ajaxform', function(e) {
        if (e.keyCode == 13 && (e.metaKey || e.ctrlKey)) {
            if (MauticVars.formSubmitInProgress) {
                return false;
            }
            var saveButton = mQuery(form).find('button.btn-save');
            var applyButton = mQuery(form).find('button.btn-apply');
            var modalParent = mQuery(form).closest('.modal');
            var inMain = mQuery(modalParent).length > 0 ? false : true;
            if (mQuery(saveButton).length) {
                if (inMain) {
                    if (mQuery(form).find('button.btn-save.btn-copy').length) {
                        mQuery(mQuery(form).find('button.btn-save.btn-copy')).trigger('click');
                        return;
                    }
                } else {
                    if (mQuery(modalParent).find('button.btn-save.btn-copy').length) {
                        mQuery(mQuery(modalParent).find('button.btn-save.btn-copy')).trigger('click');
                        return;
                    }
                }
                mQuery(saveButton).trigger('click');
            } else if (mQuery(applyButton).length) {
                if (inMain) {
                    if (mQuery(form).find('button.btn-apply.btn-copy').length) {
                        mQuery(mQuery(form).find('button.btn-apply.btn-copy')).trigger('click');
                        return;
                    }
                } else {
                    if (mQuery(modalParent).find('button.btn-apply.btn-copy').length) {
                        mQuery(mQuery(modalParent).find('button.btn-apply.btn-copy')).trigger('click');
                        return;
                    }
                }
                mQuery(applyButton).trigger('click');
            }
        } else if (e.keyCode == 13 && mQuery(e.target).is(':input')) {
            var inputs = mQuery(this).parents('form').eq(0).find(':input');
            if (inputs[inputs.index(this) + 1] != null) {
                inputs[inputs.index(this) + 1].focus();
            }
            e.preventDefault();
            return false;
        }
    });
    mQuery(form + ' :submit').each(function() {
        mQuery(this).off('click.ajaxform');
        mQuery(this).on('click.ajaxform', function() {
            if (mQuery(this).attr('name') && !mQuery('input[name="' + mQuery(this).attr('name') + '"]').length) {
                mQuery('input.button-clicked').remove();
                mQuery('form[name="' + formName + '"]').append(mQuery('<input type="hidden" class="button-clicked">').attr({
                    name: mQuery(this).attr('name'),
                    value: mQuery(this).attr('value')
                }));
            }
        });
    });
    mQuery(form).off('submit.ajaxform');
    mQuery(form).on('submit.ajaxform', (function(e) {
        e.preventDefault();
        var form = mQuery(this);
        if (MauticVars.formSubmitInProgress) {
            return false;
        } else {
            var callbackAsync = form.data('submit-callback-async');
            if (callbackAsync && typeof Mautic[callbackAsync] == 'function') {
                Mautic[callbackAsync].apply(this, [form, function() {
                    Mautic.postMauticForm(form);
                }]);
            } else {
                var callback = form.data('submit-callback');
                if (callback && typeof Mautic[callback] == 'function') {
                    if (!Mautic[callback]()) {
                        return false;
                    }
                }
                Mautic.postMauticForm(form);
            }
        }
        return false;
    }));
};
Mautic.postMauticForm = function(form) {
    MauticVars.formSubmitInProgress = true;
    Mautic.postForm(form, function(response) {
        if (response.inMain) {
            Mautic.processPageContent(response);
        } else {
            Mautic.processModalContent(response, '#' + response.modalId);
        }
    });
};
Mautic.resetForm = function(form) {
    mQuery(':input', form).not(':button, :submit, :reset, :hidden').val('').removeAttr('checked').prop('checked', false).removeAttr('selected').prop('selected', false);
    mQuery(form).find('select:not(.not-chosen):not(.multiselect)').each(function() {
        mQuery(this).find('option:selected').prop('selected', false)
        mQuery(this).trigger('chosen:updated');
    });
};
Mautic.postForm = function(form, callback) {
    var form = mQuery(form);
    var modalParent = form.closest('.modal');
    var inMain = mQuery(modalParent).length > 0 ? false : true;
    var action = form.attr('action');
    if (!inMain) {
        var modalTarget = '#' + mQuery(modalParent).attr('id');
        Mautic.startModalLoadingBar(modalTarget);
    }
    var showLoading = (!inMain || form.attr('data-hide-loadingbar')) ? false : true;
    form.ajaxSubmit({
        showLoadingBar: showLoading,
        success: function(data) {
            if (!inMain) {
                Mautic.stopModalLoadingBar(modalTarget);
            }
            if (data.redirect) {
                Mautic.redirectWithBackdrop(data.redirect);
            } else {
                MauticVars.formSubmitInProgress = false;
                if (!inMain) {
                    var modalId = mQuery(modalParent).attr('id');
                }
                if (data.sessionExpired) {
                    if (!inMain) {
                        mQuery('#' + modalId).modal('hide');
                        mQuery('.modal-backdrop').remove();
                    }
                    Mautic.processPageContent(data);
                } else if (callback) {
                    data.inMain = inMain;
                    if (!inMain) {
                        data.modalId = modalId;
                    }
                    if (typeof callback == 'function') {
                        callback(data);
                    } else if (typeof Mautic[callback] == 'function') {
                        Mautic[callback](data);
                    }
                }
            }
        },
        error: function(request, textStatus, errorThrown) {
            MauticVars.formSubmitInProgress = false;
            Mautic.processAjaxError(request, textStatus, errorThrown, inMain);
        }
    });
};
Mautic.initializeFormFieldVisibilitySwitcher = function(formName) {
    Mautic.switchFormFieldVisibilty(formName);
    mQuery('form[name="' + formName + '"]').on('change', function() {
        Mautic.switchFormFieldVisibilty(formName);
    });
};
Mautic.switchFormFieldVisibilty = function(formName) {
    var form = mQuery('form[name="' + formName + '"]');
    var fields = {};
    var fieldsPriority = {};
    var getFieldParts = function(fieldName) {
        var returnObject = {
            "name": fieldName,
            "attribute": ''
        };
        if (fieldName.search(':') !== -1) {
            var returnArray = fieldName.split(':');
            returnObject.name = returnArray[0];
            returnObject.attribute = returnArray[1];
        }
        return returnObject;
    };
    var checkValueCondition = function(sourceFieldVal, condition) {
        var visible = true;
        if (typeof condition == 'object') {
            visible = mQuery.inArray(sourceFieldVal, condition) !== -1;
        } else if (condition == 'empty' || (condition == 'notEmpty')) {
            var isEmpty = (sourceFieldVal == '' || sourceFieldVal == null || sourceFieldVal == 'undefined');
            visible = (condition == 'empty') ? isEmpty : !isEmpty;
        } else if (condition !== sourceFieldVal) {
            visible = false;
        }
        return visible;
    };
    var checkFieldCondition = function(fieldId, attribute, condition) {
        var visible = true;
        if (attribute) {
            if (typeof mQuery('#' + fieldId).attr(attribute) !== 'undefined') {
                var field = '#' + fieldId;
            } else if (mQuery('#' + fieldId).is('select')) {
                var field = mQuery('#' + fieldId + ' option[value="' + mQuery('#' + fieldId).val() + '"]');
            } else {
                return visible;
            }
            var attributeValue = (typeof mQuery(field).attr(attribute) !== 'undefined') ? mQuery(field).attr(attribute) : null;
            return checkValueCondition(attributeValue, condition);
        } else if (mQuery('#' + fieldId).is(':checkbox') || mQuery('#' + fieldId).is(':radio')) {
            return (condition == 'checked' && mQuery('#' + fieldId).is(':checked')) || (condition == '' && !mQuery('#' + fieldId).is(':checked'));
        }
        return checkValueCondition(mQuery('#' + fieldId).val(), condition);
    }
    form.find('[data-show-on]').each(function(index, el) {
        var field = mQuery(el);
        var showOn = JSON.parse(field.attr('data-show-on'));
        mQuery.each(showOn, function(fieldId, condition) {
            var fieldParts = getFieldParts(fieldId);
            if (typeof fields[field.attr('id')] === 'undefined' || !fields[field.attr('id')]) {
                fields[field.attr('id')] = checkFieldCondition(fieldParts.name, fieldParts.attribute, condition);
            }
        });
    });
    form.find('[data-hide-on]').each(function(index, el) {
        var field = mQuery(el);
        var hideOn = JSON.parse(field.attr('data-hide-on'));
        if (typeof hideOn.display_priority !== 'undefined') {
            fieldsPriority[field.attr('id')] = 'hide';
            delete hideOn.display_priority;
        }
        mQuery.each(hideOn, function(fieldId, condition) {
            var fieldParts = getFieldParts(fieldId);
            if (typeof fields[field.attr('id')] === 'undefined' || fields[field.attr('id')]) {
                fields[field.attr('id')] = !checkFieldCondition(fieldParts.name, fieldParts.attribute, condition);
            }
        });
    });
    mQuery.each(fields, function(fieldId, show) {
        var fieldContainer = mQuery('#' + fieldId).closest('[class*="col-"]');;
        if (show) {
            fieldContainer.fadeIn();
        } else {
            fieldContainer.fadeOut();
        }
    });
};
Mautic.updateEntitySelect = function(response) {
    var mQueryParent = (window.opener) ? window.opener.mQuery : mQuery;
    if (response.id) {
        var newOption = mQuery('<option />').val(response.id);
        newOption.html(response.name);
        var el = '#' + response.updateSelect;
        var sortOptions = function(options) {
            return options.sort(function(a, b) {
                var alc = a.text ? a.text.toLowerCase() : mQuery(a).attr("label").toLowerCase();
                var blc = b.text ? b.text.toLowerCase() : mQuery(b).attr("label").toLowerCase();
                return alc > blc ? 1 : alc < blc ? -1 : 0;
            });
        }
        var emptyOption = false,
            createNewOption = false;
        if (mQueryParent(el).prop('disabled')) {
            mQueryParent(el).prop('disabled', false);
            var emptyOption = mQuery('<option value="">' + mauticLang.chosenChooseOne + '</option>');
        } else {
            if (mQueryParent(el + ' option[value=""]').length) {
                emptyOption = mQueryParent(el + ' option[value=""]').clone();
                mQueryParent(el + ' option[value=""]').remove();
            }
            if (mQueryParent(el + ' option[value="new"]').length) {
                createNewOption = mQueryParent(el + ' option[value="new"]').clone();
                mQueryParent(el + ' option[value="new"]').remove();
            }
        }
        if (response.group) {
            var optgroup = el + ' optgroup[label="' + response.group + '"]';
            if (mQueryParent(optgroup).length) {
                var firstOptionGroups = mQueryParent(optgroup);
                var isUpdateOption = false;
                firstOptionGroups.each(function() {
                    var firstOptions = mQuery(this).children();
                    for (var i = 0; i < firstOptions.length; i++) {
                        if (firstOptions[i].value === response.id.toString()) {
                            firstOptions[i].text = response.name;
                            isUpdateOption = true;
                            break;
                        }
                    }
                });
                if (!isUpdateOption) {
                    mQueryParent(optgroup).append(newOption);
                }
            } else {
                var newOptgroup = mQuery('<optgroup label= />');
                newOption.appendTo(newOptgroup);
                mQueryParent(newOptgroup).appendTo(mQueryParent(el));
            }
            var optionGroups = sortOptions(mQueryParent(el + ' optgroup'));
            optionGroups.each(function() {
                var options = sortOptions(mQuery(this).children());
                mQuery(this).html(options);
            });
            var appendOptions = optionGroups;
        } else {
            newOption.appendTo(mQueryParent(el));
            var appendOptions = sortOptions(mQueryParent(el).children());
        }
        mQueryParent(el).html(appendOptions);
        if (createNewOption) {
            mQueryParent(el).prepend(createNewOption);
        }
        if (emptyOption) {
            mQueryParent(el).prepend(emptyOption);
        }
        newOption.prop('selected', true);
        mQueryParent(el).val(response.id).trigger("chosen:updated");
    }
    if (window.opener) {
        window.close();
    } else {
        mQueryParent('#MauticSharedModal').modal('hide');
    }
};
Mautic.toggleYesNoButtonClass = function(changedId) {
    changedId = '#' + changedId;
    var isYesButton = mQuery(changedId).parent().hasClass('btn-yes');
    var isExtraButton = mQuery(changedId).parent().hasClass('btn-extra');
    if (isExtraButton) {
        mQuery(changedId).parents('.btn-group').find('.btn').removeClass('btn-success btn-danger').addClass('btn-default');
    } else {
        var otherButton = isYesButton ? '.btn-no' : '.btn-yes';
        var otherLabel = mQuery(changedId).parent().parent().find(otherButton);
        if (mQuery(changedId).prop('checked')) {
            var thisRemove = 'btn-default',
                otherAdd = 'btn-default';
            if (isYesButton) {
                var thisAdd = 'btn-success',
                    otherRemove = 'btn-danger';
            } else {
                var thisAdd = 'btn-danger',
                    otherRemove = 'btn-success';
            }
        } else {
            var thisAdd = 'btn-default';
            if (isYesButton) {
                var thisAdd = 'btn-success',
                    otherRemove = 'btn-danger';
            } else {
                var thisAdd = 'btn-danger',
                    otherRemove = 'btn-success';
            }
        }
        mQuery(changedId).parent().removeClass(thisRemove).addClass(thisAdd);
        mQuery(otherLabel).removeClass(otherRemove).addClass(otherAdd);
    }
    return true;
};
Mautic.removeFormListOption = function(el) {
    var sortableDiv = mQuery(el).parents('div.sortable');
    var inputCount = mQuery(sortableDiv).parents('div.form-group').find('input.sortable-itemcount');
    var count = mQuery(inputCount).val();
    count--;
    mQuery(inputCount).val(count);
    mQuery(sortableDiv).remove();
};
Mautic.createOption = function(value, label) {
    return mQuery('<option/>').attr('value', value).text(label);
}
Mautic.updateFieldOperatorValue = function(field, action, valueOnChange, valueOnChangeArguments) {
    var fieldId = mQuery(field).attr('id');
    Mautic.activateLabelLoadingIndicator(fieldId);
    if (fieldId.indexOf('_operator') !== -1) {
        var fieldType = 'operator';
    } else if (fieldId.indexOf('_field') !== -1) {
        var fieldType = 'field';
    } else {
        return;
    }
    var fieldPrefix = fieldId.slice(0, -1 * fieldType.length);
    var fieldAlias = mQuery('#' + fieldPrefix + 'field').val();
    var fieldOperator = mQuery('#' + fieldPrefix + 'operator').val();
    Mautic.ajaxActionRequest(action, {
        'alias': fieldAlias,
        'operator': fieldOperator,
        'changed': fieldType
    }, function(response) {
        if (typeof response.options != 'undefined') {
            var valueField = mQuery('#' + fieldPrefix + 'value');
            var valueFieldAttrs = {
                'class': valueField.attr('class'),
                'id': valueField.attr('id'),
                'name': valueField.attr('name'),
                'autocomplete': valueField.attr('autocomplete'),
                'value': valueField.val()
            };
            if (mQuery('#' + fieldPrefix + 'value_chosen').length) {
                valueFieldAttrs['value'] = '';
                Mautic.destroyChosen(valueField);
            }
            if (!mQuery.isEmptyObject(response.options) && response.fieldType !== 'number') {
                var newValueField = mQuery('<select/>').attr('class', valueFieldAttrs['class']).attr('id', valueFieldAttrs['id']).attr('name', valueFieldAttrs['name']).attr('autocomplete', valueFieldAttrs['autocomplete']).attr('value', valueFieldAttrs['value']);
                mQuery.each(response.options, function(value, optgroup) {
                    if (typeof optgroup === 'object') {
                        var optgroupEl = mQuery('<optgroup/>').attr('label', value);
                        mQuery.each(optgroup, function(optVal, label) {
                            var option = Mautic.createOption(optVal, label);
                            if (response.optionsAttr && response.optionsAttr[optVal]) {
                                mQuery.each(response.optionsAttr[optVal], function(optAttr, optVal) {
                                    option.attr(optAttr, optVal);
                                });
                            }
                            optgroupEl.append(option)
                        });
                        newValueField.append(optgroupEl);
                    } else {
                        var option = Mautic.createOption(value, optgroup);
                        if (response.optionsAttr && response.optionsAttr[value]) {
                            mQuery.each(response.optionsAttr[value], function(optAttr, optVal) {
                                option.attr(optAttr, optVal);
                            });
                        }
                        newValueField.append(option);
                    }
                });
                newValueField.val(valueFieldAttrs['value']);
                valueField.replaceWith(newValueField);
                Mautic.activateChosenSelect(newValueField);
            } else {
                var newValueField = mQuery('<input/>').attr('type', 'text').attr('class', valueFieldAttrs['class']).attr('id', valueFieldAttrs['id']).attr('name', valueFieldAttrs['name']).attr('autocomplete', valueFieldAttrs['autocomplete']).attr('value', valueFieldAttrs['value']);
                if (response.disabled) {
                    newValueField.attr('value', '');
                    newValueField.prop('disabled', true);
                }
                valueField.replaceWith(newValueField);
                if (response.fieldType == 'date' || response.fieldType == 'datetime') {
                    Mautic.activateDateTimeInputs(newValueField, response.fieldType);
                }
            }
            if (valueOnChange && typeof valueOnChange == 'function') {
                mQuery('#' + fieldPrefix + 'value').on('change', function() {
                    if (typeof valueOnChangeArguments != 'object') {
                        valueOnChangeArguments = [];
                    }
                    valueOnChangeArguments.unshift(mQuery('#' + fieldPrefix + 'value'));
                    valueOnChange.apply(null, valueOnChangeArguments);
                });
            }
            if (!mQuery.isEmptyObject(response.operators)) {
                var operatorField = mQuery('#' + fieldPrefix + 'operator');
                Mautic.destroyChosen(operatorField);
                var operatorFieldAttrs = {
                    'class': operatorField.attr('class'),
                    'id': operatorField.attr('id'),
                    'name': operatorField.attr('name'),
                    'autocomplete': operatorField.attr('autocomplete'),
                    'value': operatorField.val()
                };
                var newOperatorField = mQuery('<select/>').attr('class', operatorFieldAttrs['class']).attr('id', operatorFieldAttrs['id']).attr('name', operatorFieldAttrs['name']).attr('autocomplete', operatorFieldAttrs['autocomplete']).attr('value', operatorFieldAttrs['value']).attr('onchange', 'Mautic.updateLeadFieldValues(this)');
                mQuery.each(response.operators, function(optionVal, optionKey) {
                    newOperatorField.append(Mautic.createOption(optionKey, optionVal));
                });
                newOperatorField.val(operatorField.val());
                operatorField.replaceWith(newOperatorField);
                Mautic.activateChosenSelect(newOperatorField);
            }
        }
        Mautic.removeLabelLoadingIndicator();
    });
};;
if (typeof Chart != 'undefined') {
    Chart.defaults.global.elements.line.borderWidth = 1;
    Chart.defaults.global.elements.point.radius = 2;
    Chart.defaults.global.legend.labels.boxWidth = 12;
    Chart.defaults.global.maintainAspectRatio = false;
}
Mautic.renderCharts = function(scope) {
    var charts = [];
    if (!Mautic.chartObjects) Mautic.chartObjects = [];
    if (mQuery.type(scope) === 'string') {
        charts = mQuery(scope).find('canvas.chart');
    } else if (scope) {
        charts = scope.find('canvas.chart');
    } else {
        charts = mQuery('canvas.chart');
    }
    if (charts.length) {
        charts.each(function(index, canvas) {
            canvas = mQuery(canvas);
            if (!canvas.hasClass('chart-rendered')) {
                if (canvas.hasClass('line-chart')) {
                    Mautic.renderLineChart(canvas)
                } else if (canvas.hasClass('pie-chart')) {
                    Mautic.renderPieChart(canvas)
                } else if (canvas.hasClass('bar-chart')) {
                    Mautic.renderBarChart(canvas)
                } else if (canvas.hasClass('liefechart-bar-chart')) {
                    Mautic.renderLifechartBarChart(canvas)
                } else if (canvas.hasClass('simple-bar-chart')) {
                    Mautic.renderSimpleBarChart(canvas)
                } else if (canvas.hasClass('horizontal-bar-chart')) {
                    Mautic.renderHorizontalBarChart(canvas)
                }
            }
            canvas.addClass('chart-rendered');
        });
    }
};
Mautic.renderLineChart = function(canvas) {
    var data = JSON.parse(canvas.text());
    if (!data.labels.length || !data.datasets.length) return;
    var chart = new Chart(canvas, {
        type: 'line',
        data: data,
        options: {
            lineTension: 0.2,
            borderWidth: 1,
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true
                    }
                }]
            }
        }
    });
    Mautic.chartObjects.push(chart);
};
Mautic.renderPieChart = function(canvas) {
    var data = JSON.parse(canvas.text());
    var options = {
        borderWidth: 1
    };
    var disableLegend = canvas.attr('data-disable-legend');
    if (typeof disableLegend !== 'undefined' && disableLegend !== false) {
        options.legend = {
            display: false
        }
    }
    var chart = new Chart(canvas, {
        type: 'pie',
        data: data,
        options: options
    });
    Mautic.chartObjects.push(chart);
};
Mautic.renderBarChart = function(canvas) {
    var data = JSON.parse(canvas.text());
    var chart = new Chart(canvas, {
        type: 'bar',
        data: data,
        options: {
            scales: {
                xAxes: [{
                    barPercentage: 0.9,
                }]
            }
        }
    });
    Mautic.chartObjects.push(chart);
};
Mautic.renderLifechartBarChart = function(canvas) {
    var canvasWidth = mQuery(canvas).parent().width();
    var barWidth = (canvasWidth < 300) ? 5 : 25;
    var data = JSON.parse(canvas.text());
    var chart = new Chart(canvas, {
        type: 'bar',
        data: data,
        options: {
            scales: {
                xAxes: [{
                    barThickness: barWidth,
                }]
            }
        }
    });
    Mautic.chartObjects.push(chart);
};
Mautic.renderSimpleBarChart = function(canvas) {
    var data = JSON.parse(canvas.text());
    var chart = new Chart(canvas, {
        type: 'bar',
        data: data,
        options: {
            scales: {
                xAxes: [{
                    stacked: false,
                    ticks: {
                        fontSize: 9
                    },
                    gridLines: {
                        display: false
                    },
                }],
                yAxes: [{
                    display: false,
                    stacked: false,
                    ticks: {
                        beginAtZero: true,
                        display: false
                    },
                    gridLines: {
                        display: false
                    }
                }],
                display: false
            },
            legend: {
                display: false
            }
        }
    });
    Mautic.chartObjects.push(chart);
};
Mautic.renderHorizontalBarChart = function(canvas) {
    var data = JSON.parse(canvas.text());
    var chart = new Chart(canvas, {
        type: 'horizontalBar',
        data: data,
        options: {
            scales: {
                xAxes: [{
                    display: true,
                    stacked: false,
                    gridLines: {
                        display: false
                    },
                    ticks: {
                        beginAtZero: true,
                        display: true,
                        fontSize: 8,
                        stepSize: 5
                    }
                }],
                yAxes: [{
                    stacked: false,
                    ticks: {
                        beginAtZero: true,
                        display: true,
                        fontSize: 9
                    },
                    gridLines: {
                        display: false
                    },
                    barPercentage: 0.5,
                    categorySpacing: 1
                }],
                display: false
            },
            legend: {
                display: false
            },
            tooltips: {
                mode: 'single',
                bodyFontSize: 9,
                bodySpacing: 0,
                callbacks: {
                    title: function(tooltipItems, data) {
                        return '';
                    },
                    label: function(tooltipItem, data) {
                        return tooltipItem.xLabel + ': ' + tooltipItem.yLabel;
                    }
                }
            }
        }
    });
    Mautic.chartObjects.push(chart);
};
Mautic.renderMaps = function(scope) {
    var maps = [];
    if (mQuery.type(scope) === 'string') {
        maps = mQuery(scope).find('.vector-map');
    } else if (scope) {
        maps = scope.find('.vector-map');
    } else {
        maps = mQuery('.vector-map');
    }
    if (maps.length) {
        maps.each(function(index, element) {
            Mautic.renderMap(mQuery(element));
        });
    }
};
Mautic.renderMap = function(wrapper) {
    if (wrapper.is(':visible')) {
        if (!Mautic.mapObjects) Mautic.mapObjects = [];
        var data = wrapper.data('map-data');
        if (typeof data === 'undefined' || !data.length) {
            try {
                data = JSON.parse(wrapper.text());
                wrapper.data('map-data', data);
            } catch (error) {
                return;
            }
        }
        var firstKey = Object.keys(data)[0];
        if (firstKey == "0") {
            var markersData = data,
                regionsData = {};
        } else {
            var markersData = {},
                regionsData = data;
        }
        wrapper.text('');
        wrapper.vectorMap({
            backgroundColor: 'transparent',
            zoomOnScroll: false,
            markers: markersData,
            markerStyle: {
                initial: {
                    fill: '#40C7B5'
                },
                selected: {
                    fill: '#40C7B5'
                }
            },
            regionStyle: {
                initial: {
                    "fill": '#dce0e5',
                    "fill-opacity": 1,
                    "stroke": 'none',
                    "stroke-width": 0,
                    "stroke-opacity": 1
                },
                hover: {
                    "fill-opacity": 0.7,
                    "cursor": 'pointer'
                }
            },
            map: 'world_mill_en',
            series: {
                regions: [{
                    values: regionsData,
                    scale: ['#dce0e5', '#40C7B5'],
                    normalizeFunction: 'polynomial'
                }]
            },
            onRegionTipShow: function(event, label, index) {
                if (data[index] > 0) {
                    label.html('<b>' + label.html() + '</b></br>' +
                        data[index] + ' Leads');
                }
            }
        });
        wrapper.addClass('map-rendered');
        Mautic.mapObjects.push(wrapper);
        return wrapper;
    }
};
Mautic.destroyMap = function(wrapper) {
    if (wrapper.hasClass('map-rendered')) {
        var map = wrapper.vectorMap('get', 'mapObject');
        map.removeAllMarkers();
        map.remove();
        wrapper.empty();
        wrapper.removeClass('map-rendered');
    }
};
Mautic.initDateRangePicker = function(fromId, toId) {
    var dateFrom = mQuery(fromId);
    var dateTo = mQuery(toId);
    if (dateFrom.length && dateTo.length) {
        dateFrom.datetimepicker({
            format: 'M j, Y',
            onShow: function(ct) {
                this.setOptions({
                    maxDate: dateTo.val() ? new Date(dateTo.val()) : false
                });
            },
            timepicker: false,
            scrollMonth: false,
            scrollInput: false
        });
        dateTo.datetimepicker({
            format: 'M j, Y',
            onShow: function(ct) {
                this.setOptions({
                    maxDate: new Date(),
                    minDate: dateFrom.val() ? new Date(dateFrom.val()) : false
                });
            },
            timepicker: false,
            scrollMonth: false,
            scrollInput: false
        });
    }
};
Mautic.getChartData = function(element, action, query, callback) {
    var element = mQuery(element);
    var wrapper = element.closest('ul');
    var button = mQuery('#time-scopes .button-label');
    wrapper.find('a').removeClass('bg-primary');
    element.addClass('bg-primary');
    button.text(element.text());
    query = query + '&action=' + action;
    mQuery.ajax({
        showLoadingBar: true,
        url: mauticAjaxUrl,
        type: 'POST',
        data: query,
        dataType: "json",
        success: function(response) {
            if (response.success) {
                Mautic.stopPageLoadingBar();
                if (typeof callback == 'function') {
                    callback(response);
                } else if (typeof window["Mautic"][callback] !== 'undefined') {
                    window["Mautic"][callback].apply('window', [response]);
                }
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        }
    });
};
Mautic.emulateNoDataForPieChart = function(data) {
    var dataEmpty = true;
    mQuery.each(data, function(i, part) {
        if (part.value) {
            dataEmpty = false;
        }
    });
    if (dataEmpty) {
        data = [{
            value: 1,
            color: "#efeeec",
            highlight: "#EBEBEB",
            label: "No data"
        }];
    }
    return data;
};;
Mautic.activateSortablePanels = function(container) {
    mQuery(container).find('.available-panel-selector').each(function() {
        var sortablesContainer = mQuery(this).closest('.sortable-panels');
        var selector = this;
        var prefix = mQuery(selector).data('prototype-prefix');
        mQuery(selector).on('change', function() {
            var selected = mQuery(this).val();
            selected = selected.replace('.', '-');
            var prototype = '#' + prefix + selected;
            console.log(prototype);
            if (mQuery(prototype).length) {
                console.log('exists');
                Mautic.appendSortablePanel(sortablesContainer, prototype);
            }
            mQuery(selector).val('');
            mQuery(selector).trigger('chosen:updated');
        });
        var bodyOverflow = {};
        mQuery(sortablesContainer).sortable({
            items: '.panel',
            handle: '.sortable-panel-wrapper',
            cancel: '',
            helper: function(e, ui) {
                ui.children().each(function() {
                    if (!mQuery(this).hasClass('modal')) {
                        mQuery(this).width(mQuery(this).width());
                    }
                });
                bodyOverflow.overflowX = mQuery('body').css('overflow-x');
                bodyOverflow.overflowY = mQuery('body').css('overflow-y');
                mQuery('body').css({
                    overflowX: 'visible',
                    overflowY: 'visible'
                });
                return ui;
            },
            scroll: true,
            axis: 'y',
            containment: '#' + mQuery(sortablesContainer).attr('id') + ' .drop-here',
            stop: function(e, ui) {
                mQuery('body').css(bodyOverflow);
                mQuery(ui.item).attr('style', '');
            }
        });
    });
    var sortable = mQuery(container).hasClass('sortable-panels') ? container : mQuery(container).find('.sortable-panels');
    mQuery(sortable).find('.sortable-panel-wrapper').each(function() {
        Mautic.activateSortablePanel(mQuery(this).closest('.panel'));
    });
};
Mautic.activateSortablePanel = function(panel) {
    mQuery(panel).find('.sortable-panel-buttons').each(function() {
        mQuery(this).find('.btn-delete').on('click', function() {
            Mautic.deleteSortablePanel(mQuery(this).closest('.panel'));
        });
        mQuery(this).find('.btn-edit').on('click', function() {
            Mautic.showModal('#' + mQuery(panel).find('.modal').attr('id'));
        });
    });
    mQuery(panel).find('select').not('.multiselect, .not-chosen').each(function() {
        Mautic.activateChosenSelect(this, true);
    });
    mQuery(panel).on('dblclick.sortablepanels', function(event) {
        event.preventDefault();
        mQuery(this).find('.btn-edit').first().click();
    });
    if (mQuery(panel).hasClass('sortable-has-error')) {
        var originalClass = mQuery(panel).find('.btn-edit i.fa').attr('class');
        mQuery(panel).find('.btn-edit i.fa').attr('data-original-icon', originalClass);
        mQuery(panel).find('.btn-edit i.fa').attr('class', 'fa fa-warning text-warning');
    }
};
Mautic.appendSortablePanel = function(sortablesContainer, modal) {
    var newIdPrefix = mQuery(sortablesContainer).find('.available-panel-selector').attr('data-prototype-id-prefix');
    var newNamePrefix = mQuery(sortablesContainer).find('.available-panel-selector').attr('data-prototype-name-prefix');
    var oldIdPrefix = mQuery(modal).attr('data-id-prefix');
    var oldNamePrefix = mQuery(modal).attr('data-name-prefix');
    var index = parseInt(mQuery(sortablesContainer).attr('data-index'));
    var panelId = index + 1;
    mQuery(sortablesContainer).attr('data-index', panelId);
    var panelName = mQuery(modal).attr('data-name');
    oldIdPrefix = oldIdPrefix + panelName;
    oldNamePrefix = oldNamePrefix + '[' + panelName + ']';
    newIdPrefix = newIdPrefix + index;
    newNamePrefix = newNamePrefix + '[' + index + ']';
    var newPanel = mQuery(sortablesContainer).find('.panel-prototype .panel').clone();
    var selectedPanel = mQuery(sortablesContainer).find('.available-panel-selector').children('option:selected');
    var placeholders = selectedPanel.attr('data-placeholders');
    if (placeholders) {
        placeholders = JSON.parse(placeholders);
        var newPanelContent = mQuery(newPanel).html();
        mQuery.each(placeholders, function(key, val) {
            newPanelContent = newPanelContent.replace(key, val);
        });
        newPanel.html(newPanelContent);
    }
    mQuery(newPanel).addClass('new-panel');
    mQuery(newPanel).attr('data-default-label', selectedPanel.attr('data-default-label'));
    mQuery(sortablesContainer).find('.drop-here').append(newPanel);
    var newModal = mQuery(modal).clone();
    mQuery(newModal).removeClass('in').css('display', 'none');
    mQuery(newModal).attr('id', mQuery(newModal).attr('id').replace(oldIdPrefix, newIdPrefix));
    mQuery(newModal).find('button[data-embedded-form="cancel"]').removeAttr('data-embedded-form-clear');
    mQuery(newModal).find('button[data-embedded-form-callback="cancelSortablePanel"]').removeAttr('data-embedded-form-callback');
    mQuery(newModal).modal('hide');
    newPanel.append(newModal);
    Mautic.renameFormElements(newModal, oldIdPrefix, oldNamePrefix, newIdPrefix, newNamePrefix)
    Mautic.activateModalEmbeddedForms('#' + mQuery(newModal).attr('id'));
    Mautic.showModal(newModal);
    mQuery(newModal).find('select').not('.multiselect, .not-chosen').each(function() {
        Mautic.activateChosenSelect(this);
    });
};
Mautic.updateSortablePanel = function(modalBtn, modal) {
    var panel = mQuery(modal).closest('.panel');
    var label = '';
    var hasNameField = false;
    if (mQuery(modalBtn).attr('data-panel-label')) {
        label = mQuery(modalBtn).attr('data-panel-label');
    } else if (mQuery(modal).attr('data-panel-label')) {
        label = mQuery(modal).attr('data-panel-label');
    } else if (mQuery(modal).find("input[name$='[name]']").length) {
        label = mQuery(modal).find("input[name$='[name]']").val();
        hasNameField = true;
    }
    if (!label.length) {
        label = mQuery(panel).attr('data-default-label');
        if (hasNameField) {
            mQuery(modal).find("input[name$='[name]']").val(label);
        }
    }
    mQuery(panel).find('.sortable-panel-label').html(label);
    var footer = '';
    if (mQuery(modalBtn).attr('data-panel-footer')) {
        var footer = mQuery(modalBtn).attr('data-panel-footer');
    } else if (mQuery(modal).attr('data-panel-footer')) {
        var footer = mQuery(modal).attr('data-panel-footer');
    }
    mQuery(panel).find('.sortable-panel.footer').html(footer);
    if (mQuery(panel).hasClass('sortable-has-error')) {
        mQuery(panel).removeClass('sortable-has-error');
        var editBtn = mQuery(panel).find('.btn-edit i');
        if (editBtn.length) {
            editBtn.attr('class', editBtn.attr('data-original-icon'));
        }
    }
    Mautic.activateSortablePanel(panel);
    mQuery(panel).removeClass('new-panel');
    mQuery(panel).find('.modal .btn-add').addClass('hide');
    mQuery(panel).find('.modal .btn-update').removeClass('hide');
    Mautic.toggleSortablePanelAddMessage(mQuery(panel).closest('.sortable-panels'));
};
Mautic.deleteSortablePanel = function(panel) {
    var panelContainer = mQuery(panel).closest('.sortable-panels');
    mQuery(panel).remove();
    Mautic.toggleSortablePanelAddMessage(panelContainer);
};
Mautic.cancelSortablePanel = function(modalBtn, modal) {
    setTimeout(function() {
        mQuery(modal).closest('.panel').remove();
    }, 500);
}
Mautic.toggleSortablePanelAddMessage = function(panelContainer) {
    var panelsLeft = mQuery(panelContainer).find('.sortable-panel-wrapper').length;
    mQuery(panelContainer).find('.sortable-panel-placeholder').each(function() {
        if (panelsLeft <= 1) {
            mQuery(this).removeClass('hide');
        } else {
            mQuery(this).addClass('hide');
        }
    });
};;
Mautic.modalContentXhr = {};
Mautic.activeModal = '';
Mautic.backgroundedModal = '';
Mautic.ajaxifyModal = function(el, event) {
    if (mQuery(el).hasClass('disabled')) {
        return false;
    }
    var target = mQuery(el).attr('data-target');
    var route = (mQuery(el).attr('data-href')) ? mQuery(el).attr('data-href') : mQuery(el).attr('href');
    if (route.indexOf('javascript') >= 0) {
        return false;
    }
    mQuery('body').addClass('noscroll');
    var method = mQuery(el).attr('data-method');
    if (!method) {
        method = 'GET'
    }
    var header = mQuery(el).attr('data-header');
    var footer = mQuery(el).attr('data-footer');
    var preventDismissal = mQuery(el).attr('data-prevent-dismiss');
    if (preventDismissal) {
        mQuery(el).removeAttr('data-prevent-dismiss');
    }
    Mautic.loadAjaxModal(target, route, method, header, footer, preventDismissal);
};
Mautic.loadAjaxModal = function(target, route, method, header, footer, preventDismissal) {
    if (mQuery(target + ' .loading-placeholder').length) {
        mQuery(target + ' .loading-placeholder').removeClass('hide');
        mQuery(target + ' .modal-body-content').addClass('hide');
        if (mQuery(target + ' .modal-loading-bar').length) {
            mQuery(target + ' .modal-loading-bar').addClass('active');
        }
    }
    if (footer == 'false') {
        mQuery(target + " .modal-footer").addClass('hide');
    }
    mQuery(target).one('show.bs.modal', function() {
        if (header) {
            mQuery(target + " .modal-title").html(header);
        }
        if (footer && footer != 'false') {
            mQuery(target + " .modal-footer").html(header);
        }
    });
    mQuery(target).one('hidden.bs.modal', function() {
        if (typeof Mautic.modalContentXhr[target] != 'undefined') {
            Mautic.modalContentXhr[target].abort();
            delete Mautic.modalContentXhr[target];
        }
        mQuery('body').removeClass('noscroll');
        var response = {};
        if (Mautic.modalMauticContent) {
            response.mauticContent = Mautic.modalMauticContent;
            delete Mautic.modalMauticContent;
        }
        Mautic.onPageUnload(target, response);
        Mautic.resetModal(target);
    });
    if (typeof mQuery(target).data('bs.modal') !== 'undefined' && typeof mQuery(target).data('bs.modal').options !== 'undefined') {
        if (preventDismissal) {
            mQuery(target).data('bs.modal').options.keyboard = false;
            mQuery(target).data('bs.modal').options.backdrop = 'static';
        } else {
            mQuery(target).data('bs.modal').options.keyboard = true;
            mQuery(target).data('bs.modal').options.backdrop = true;
        }
    } else {
        if (preventDismissal) {
            mQuery(target).modal({
                backdrop: 'static',
                keyboard: false
            });
        } else {
            mQuery(target).modal({
                backdrop: true,
                keyboard: true
            });
        }
    }
    Mautic.showModal(target);
    if (typeof Mautic.modalContentXhr == 'undefined') {
        Mautic.modalContentXhr = {};
    } else if (typeof Mautic.modalContentXhr[target] != 'undefined') {
        Mautic.modalContentXhr[target].abort();
    }
    Mautic.modalContentXhr[target] = mQuery.ajax({
        url: route,
        type: method,
        dataType: "json",
        success: function(response) {
            if (response) {
                Mautic.processModalContent(response, target);
            }
            Mautic.stopIconSpinPostEvent();
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
            Mautic.stopIconSpinPostEvent();
        },
        complete: function() {
            Mautic.stopModalLoadingBar(target);
            delete Mautic.modalContentXhr[target];
        }
    });
};
Mautic.resetModal = function(target) {
    if (mQuery(target).hasClass('in')) {
        return;
    }
    mQuery(target + " .modal-title").html('');
    mQuery(target + " .modal-body-content").html('');
    if (mQuery(target + " loading-placeholder").length) {
        mQuery(target + " loading-placeholder").removeClass('hide');
    }
    if (mQuery(target + " .modal-footer").length) {
        var hasFooterButtons = mQuery(target + " .modal-footer .modal-form-buttons").length;
        mQuery(target + " .modal-footer").html('');
        if (hasFooterButtons) {
            mQuery('<div class="modal-form-buttons" />').appendTo(target + " .modal-footer");
        }
        mQuery(target + " .modal-footer").removeClass('hide');
    }
};
Mautic.processModalContent = function(response, target) {
    Mautic.stopIconSpinPostEvent();
    if (response.error) {
        if (response.errors) {
            alert(response.errors[0].message);
        } else if (response.error.message) {
            alert(response.error.message);
        } else {
            alert(response.error);
        }
        return;
    }
    if (response.sessionExpired || (response.closeModal && response.newContent && !response.updateModalContent)) {
        mQuery(target).modal('hide');
        mQuery('body').removeClass('modal-open');
        mQuery('.modal-backdrop').remove();
        Mautic.processPageContent(response);
    } else {
        if (response.notifications) {
            Mautic.setNotifications(response.notifications);
        }
        if (response.browserNotifications) {
            Mautic.setBrowserNotifications(response.browserNotifications);
        }
        if (response.callback) {
            window["Mautic"][response.callback].apply('window', [response]);
            return;
        }
        if (response.target) {
            mQuery(response.target).html(response.newContent);
            Mautic.onPageLoad(response.target, response, true);
        } else if (response.newContent) {
            if (mQuery(target + ' .loading-placeholder').length) {
                mQuery(target + ' .loading-placeholder').addClass('hide');
                mQuery(target + ' .modal-body-content').html(response.newContent);
                mQuery(target + ' .modal-body-content').removeClass('hide');
            } else {
                mQuery(target + ' .modal-body').html(response.newContent);
            }
        }
        Mautic.onPageLoad(target, response, true);
        Mautic.modalMauticContent = false;
        if (response.closeModal) {
            mQuery('body').removeClass('noscroll');
            mQuery(target).modal('hide');
            if (!response.updateModalContent) {
                Mautic.onPageUnload(target, response);
            }
        } else {
            Mautic.modalMauticContent = response.mauticContent ? response.mauticContent : false;
        }
    }
};
Mautic.showConfirmation = function(el) {
    var precheck = mQuery(el).data('precheck');
    if (precheck) {
        if (typeof precheck == 'function') {
            if (!precheck()) {
                return;
            }
        } else if (typeof Mautic[precheck] == 'function') {
            if (!Mautic[precheck]()) {
                return;
            }
        }
    }
    var message = mQuery(el).data('message');
    var confirmText = mQuery(el).data('confirm-text');
    var confirmAction = mQuery(el).attr('href');
    var confirmCallback = mQuery(el).data('confirm-callback');
    var cancelText = mQuery(el).data('cancel-text');
    var cancelCallback = mQuery(el).data('cancel-callback');
    var confirmContainer = mQuery("<div />").attr({
        "class": "modal fade confirmation-modal"
    });
    var confirmDialogDiv = mQuery("<div />").attr({
        "class": "modal-dialog"
    });
    var confirmContentDiv = mQuery("<div />").attr({
        "class": "modal-content"
    });
    var confirmFooterDiv = mQuery("<div />").attr({
        "class": "modal-body text-center"
    });
    var confirmHeaderDiv = mQuery("<div />").attr({
        "class": "modal-header"
    });
    confirmHeaderDiv.append(mQuery('<h4 />').attr({
        "class": "modal-title"
    }).text(message));
    var confirmButton = mQuery('<button type="button" />').addClass("btn btn-danger").css("marginRight", "5px").css("marginLeft", "5px").click(function() {
        if (typeof Mautic[confirmCallback] === "function") {
            window["Mautic"][confirmCallback].apply('window', [confirmAction, el]);
        }
    }).html(confirmText);
    if (cancelText) {
        var cancelButton = mQuery('<button type="button" />').addClass("btn btn-primary").click(function() {
            if (cancelCallback && typeof Mautic[cancelCallback] === "function") {
                window["Mautic"][cancelCallback].apply('window', []);
            } else {
                Mautic.dismissConfirmation();
            }
        }).html(cancelText);
    }
    if (typeof cancelButton != 'undefined') {
        confirmFooterDiv.append(cancelButton);
    }
    confirmFooterDiv.append(confirmButton);
    confirmContentDiv.append(confirmHeaderDiv);
    confirmContentDiv.append(confirmFooterDiv);
    confirmContainer.append(confirmDialogDiv.append(confirmContentDiv));
    mQuery('body').append(confirmContainer);
    mQuery('.confirmation-modal').on('hidden.bs.modal', function() {
        mQuery(this).remove();
    });
    mQuery('.confirmation-modal').modal('show');
};
Mautic.dismissConfirmation = function() {
    if (mQuery('.confirmation-modal').length) {
        mQuery('.confirmation-modal').modal('hide');
    }
};
Mautic.closeModalAndRedirect = function(el, url) {
    Mautic.startModalLoadingBar(el);
    Mautic.loadContent(url);
    mQuery('body').removeClass('noscroll');
};
Mautic.loadAjaxModalBySelectValue = function(el, value, route, header) {
    var selectVal = mQuery(el).val();
    var hasValue = (selectVal == value);
    if (!hasValue && mQuery.isArray(selectVal)) {
        hasValue = (mQuery.inArray(value, selectVal) !== -1);
    }
    if (hasValue) {
        route = route + (route.indexOf('?') > -1 ? '&' : '?') + 'modal=1&contentOnly=1&updateSelect=' + mQuery(el).attr('id');
        mQuery(el).find('option[value="' + value + '"]').prop('selected', false);
        mQuery(el).trigger("chosen:updated");
        Mautic.loadAjaxModal('#MauticSharedModal', route, 'get', header);
    }
};
Mautic.showModal = function(target) {
    if (mQuery('.modal.in').length) {
        if (mQuery(target).closest('.modal').length) {
            mQuery('<div />').attr('data-modal-placeholder', target).insertAfter(mQuery(target));
            mQuery(target).attr('data-modal-moved', 1);
            mQuery(target).appendTo('body');
        }
        var activeModal = mQuery('.modal.in .modal-dialog:not(:has(.aside))').parents('.modal').last(),
            targetModal = mQuery(target);
        if (activeModal.length && activeModal.attr('id') !== targetModal.attr('id')) {
            targetModal.attr('data-previous-modal', '#' + activeModal.attr('id'));
            activeModal.find('.modal-dialog').addClass('aside');
            var stackedDialogCount = mQuery('.modal.in .modal-dialog.aside').length;
            if (stackedDialogCount <= 5) {
                activeModal.find('.modal-dialog').addClass('aside-' + stackedDialogCount);
            }
            mQuery(target).on('hide.bs.modal', function() {
                var modal = mQuery(this);
                var previous = modal.attr('data-previous-modal');
                if (previous) {
                    mQuery(previous).find('.modal-dialog').removeClass('aside');
                    mQuery(modal).attr('data-previous-modal', undefined);
                }
                if (mQuery(modal).attr('data-modal-moved')) {
                    mQuery('[data-modal-placeholder]').replaceWith(mQuery(modal));
                    mQuery(modal).attr('data-modal-moved', undefined);
                }
            });
        }
    }
    mQuery(target).modal('show');
};;
MauticVars.liveCache = new Array();
MauticVars.lastSearchStr = "";
MauticVars.globalLivecache = new Array();
MauticVars.lastGlobalSearchStr = "";
Mautic.isNewEntity = function(idInputSelector) {
    id = mQuery(idInputSelector);
    if (id.length) {
        return id.val().match("^new_");
    }
    return null;
};
Mautic.getEntityId = function() {
    return (mQuery('input#entityId').length) ? mQuery('input#entityId').val() : 0;
};
Mautic.reorderTableData = function(name, orderby, tmpl, target, baseUrl) {
    if (typeof baseUrl == 'undefined') {
        baseUrl = window.location.pathname;
    }
    if (baseUrl.indexOf('tmpl') == -1) {
        baseUrl = baseUrl + "?tmpl=" + tmpl
    }
    var route = baseUrl + "&name=" + name + "&orderby=" + encodeURIComponent(orderby);
    Mautic.loadContent(route, '', 'POST', target);
};
Mautic.filterTableData = function(name, filterby, filterValue, tmpl, target, baseUrl) {
    if (typeof baseUrl == 'undefined') {
        baseUrl = window.location.pathname;
    }
    if (baseUrl.indexOf('tmpl') == -1) {
        baseUrl = baseUrl + "?tmpl=" + tmpl
    }
    var route = baseUrl + "&name=" + name + "&filterby=" + encodeURIComponent(filterby) + "&value=" + encodeURIComponent(filterValue)
    Mautic.loadContent(route, '', 'POST', target);
};
Mautic.limitTableData = function(name, limit, tmpl, target, baseUrl) {
    if (typeof baseUrl == 'undefined') {
        baseUrl = window.location.pathname;
    }
    if (baseUrl.indexOf('tmpl') == -1) {
        baseUrl = baseUrl + "?tmpl=" + tmpl
    }
    var route = baseUrl + "&name=" + name + "&limit=" + limit;
    Mautic.loadContent(route, '', 'POST', target);
};
Mautic.filterList = function(e, elId, route, target, liveCacheVar, action, overlayEnabled, overlayTarget) {
    if (typeof liveCacheVar == 'undefined') {
        liveCacheVar = "liveCache";
    }
    var el = mQuery('#' + elId);
    if (el.length && (e.data.livesearch || mQuery(e.target).prop('tagName') == 'BUTTON' || mQuery(e.target).parent().prop('tagName') == 'BUTTON')) {
        var value = el.val().trim();
        if (!value) {
            action = 'clear';
        } else if (action == 'clear') {
            el.val('');
            el.typeahead('val', '');
            value = '';
        }
        if (false && value && value in MauticVars[liveCacheVar]) {
            var response = {
                "newContent": MauticVars[liveCacheVar][value]
            };
            response.target = target;
            response.overlayEnabled = overlayEnabled;
            response.overlayTarget = overlayTarget;
            Mautic.processPageContent(response);
        } else {
            var searchName = el.attr('name');
            if (searchName == 'undefined') {
                searchName = 'search';
            }
            if (typeof Mautic.liveSearchXhr !== 'undefined') {
                Mautic['liveSearchXhr'].abort();
            }
            var btn = "button[data-livesearch-parent='" + elId + "']";
            if (mQuery(btn).length && !mQuery(btn).hasClass('btn-nospin') && !Mautic.filterButtonClicked) {
                Mautic.startIconSpinOnEvent(btn);
            }
            var tmpl = mQuery('#' + elId).data('tmpl');
            if (!tmpl) {
                tmpl = 'list';
            }
            var tmplParam = (route.indexOf('tmpl') == -1) ? '&tmpl=' + tmpl : '';
            var checkInModalTarget = (overlayTarget) ? overlayTarget : target;
            var modalParent = mQuery(checkInModalTarget).closest('.modal');
            var inModal = mQuery(modalParent).length > 0;
            if (inModal) {
                var modalTarget = '#' + mQuery(modalParent).attr('id');
                Mautic.startModalLoadingBar(modalTarget);
            }
            var showLoading = (inModal) ? false : true;
            Mautic.liveSearchXhr = mQuery.ajax({
                showLoadingBar: showLoading,
                url: route,
                type: "GET",
                data: searchName + "=" + encodeURIComponent(value) + tmplParam,
                dataType: "json",
                success: function(response) {
                    if (response.newContent) {
                        MauticVars[liveCacheVar][value] = response.newContent;
                    }
                    response.target = target;
                    response.overlayEnabled = overlayEnabled;
                    response.overlayTarget = overlayTarget;
                    if (mQuery(btn).length) {
                        if (action == 'clear') {
                            mQuery(btn).attr('data-livesearch-action', 'search');
                            mQuery(btn).children('i').first().removeClass('fa-eraser').addClass('fa-search');
                        } else {
                            mQuery(btn).attr('data-livesearch-action', 'clear');
                            mQuery(btn).children('i').first().removeClass('fa-search').addClass('fa-eraser');
                        }
                    }
                    if (inModal) {
                        Mautic.processModalContent(response);
                        Mautic.stopModalLoadingBar(modalTarget);
                    } else {
                        Mautic.processPageContent(response);
                        Mautic.stopPageLoadingBar();
                    }
                },
                error: function(request, textStatus, errorThrown) {
                    Mautic.processAjaxError(request, textStatus, errorThrown);
                    if (mQuery(btn).length) {
                        if (action == 'clear') {
                            mQuery(btn).attr('data-livesearch-action', 'search');
                            mQuery(btn).children('i').first().removeClass('fa-eraser').addClass('fa-search');
                        } else {
                            mQuery(btn).attr('data-livesearch-action', 'clear');
                            mQuery(btn).children('i').first().removeClass('fa-search').addClass('fa-eraser');
                        }
                    }
                },
                complete: function() {
                    delete Mautic.liveSearchXhr;
                    delete Mautic.filterButtonClicked;
                }
            });
        }
    }
};
Mautic.setSearchFilter = function(el, searchId, string) {
    if (typeof searchId == 'undefined')
        searchId = '#list-search';
    else
        searchId = '#' + searchId;
    if (string || string === '') {
        var current = string;
    } else {
        var filter = mQuery(el).val();
        var current = mQuery('#list-search').typeahead('val') + " " + filter;
    }
    mQuery(searchId).typeahead('val', current);
    var e = mQuery.Event("keypress", {
        which: 13
    });
    e.data = {};
    e.data.livesearch = true;
    Mautic.filterList(e, 'list-search', mQuery(searchId).attr('data-action'), mQuery(searchId).attr('data-target'), 'liveCache');
};
Mautic.unlockEntity = function(model, id, parameter) {
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: "action=unlockEntity&model=" + model + "&id=" + id + "&parameter=" + parameter,
        dataType: "json"
    });
};
Mautic.togglePublishStatus = function(event, el, model, id, extra, backdrop) {
    event.preventDefault();
    var wasPublished = mQuery(el).hasClass('fa-toggle-on');
    mQuery(el).removeClass('fa-toggle-on fa-toggle-off').addClass('fa-spin fa-spinner');
    mQuery(el).tooltip('destroy');
    MauticVars.liveCache = new Array();
    if (backdrop) {
        Mautic.activateBackdrop();
    }
    if (extra) {
        extra = '&' + extra;
    }
    mQuery(el).tooltip('destroy');
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: "action=togglePublishStatus&model=" + model + '&id=' + id + extra,
        dataType: "json",
        success: function(response) {
            if (response.reload) {
                Mautic.redirectWithBackdrop(window.location);
            } else if (response.statusHtml) {
                mQuery(el).replaceWith(response.statusHtml);
                mQuery(el).tooltip({
                    html: true,
                    container: 'body'
                });
            }
        },
        error: function(request, textStatus, errorThrown) {
            var addClass = (wasPublished) ? 'fa-toggle-on' : 'fa-toggle-off';
            mQuery(el).removeClass('fa-spin fa-spinner').addClass(addClass);
            Mautic.processAjaxError(request, textStatus, errorThrown);
        }
    });
};
Mautic.executeBatchAction = function(action, el) {
    if (typeof Mautic.activeActions == 'undefined') {
        Mautic.activeActions = {};
    } else if (typeof Mautic.activeActions[action] != 'undefined') {
        return;
    }
    var items = Mautic.getCheckedListIds(el, true);
    var queryGlue = action.indexOf('?') >= 0 ? '&' : '?';
    var action = action + queryGlue + 'ids=' + items;
    Mautic.executeAction(action);
};
Mautic.batchActionPrecheck = function(container) {
    if (typeof container == 'undefined') {
        container = '';
    }
    return mQuery(container + ' input[class=list-checkbox]:checked').length;
};
Mautic.getCheckedListIds = function(el, stringify) {
    var checkboxes = 'input[class=list-checkbox]:checked';
    if (typeof el != 'undefined' && el) {
        var target = mQuery(el).data('target');
        if (target) {
            checkboxes = target + ' ' + checkboxes;
        }
    }
    var items = mQuery(checkboxes).map(function() {
        return mQuery(this).val();
    }).get();
    if (stringify) {
        items = JSON.stringify(items);
    }
    return items;
};;
Mautic.builderTokens = {};
Mautic.dynamicContentTokens = {};
Mautic.builderTokensRequestInProgress = false;
Mautic.activateGlobalFroalaOptions = function() {
    Mautic.basicFroalaOptions = {
        enter: mQuery.FroalaEditor.ENTER_BR,
        imageUploadURL: mauticBaseUrl + 's/file/upload',
        imageManagerLoadURL: mauticBaseUrl + 's/file/list',
        imageManagerDeleteURL: mauticBaseUrl + 's/file/delete',
        imageDefaultWidth: 0,
        pastePlain: true,
        htmlAllowedTags: ['a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'blockquote', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'keygen', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'menu', 'menuitem', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'param', 'pre', 'progress', 'queue', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'style', 'section', 'select', 'small', 'source', 'span', 'strike', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr', 'center'],
        htmlAllowedAttrs: ['data-atwho-at-query', 'data-section', 'data-section-wrapper', 'accept', 'accept-charset', 'accesskey', 'action', 'align', 'allowfullscreen', 'alt', 'async', 'autocomplete', 'autofocus', 'autoplay', 'autosave', 'background', 'bgcolor', 'border', 'charset', 'cellpadding', 'cellspacing', 'checked', 'cite', 'class', 'color', 'cols', 'colspan', 'content', 'contenteditable', 'contextmenu', 'controls', 'coords', 'data', 'data-.*', 'datetime', 'default', 'defer', 'dir', 'dirname', 'disabled', 'download', 'draggable', 'dropzone', 'enctype', 'for', 'form', 'formaction', 'frameborder', 'headers', 'height', 'hidden', 'high', 'href', 'hreflang', 'http-equiv', 'icon', 'id', 'ismap', 'itemprop', 'keytype', 'kind', 'label', 'lang', 'language', 'list', 'loop', 'low', 'max', 'maxlength', 'media', 'method', 'min', 'mozallowfullscreen', 'multiple', 'name', 'novalidate', 'open', 'optimum', 'pattern', 'ping', 'placeholder', 'poster', 'preload', 'pubdate', 'radiogroup', 'readonly', 'rel', 'required', 'reversed', 'rows', 'rowspan', 'sandbox', 'scope', 'scoped', 'scrolling', 'seamless', 'selected', 'shape', 'size', 'sizes', 'span', 'src', 'srcdoc', 'srclang', 'srcset', 'start', 'step', 'summary', 'spellcheck', 'style', 'tabindex', 'target', 'title', 'type', 'translate', 'usemap', 'value', 'valign', 'webkitallowfullscreen', 'width', 'wrap'],
        htmlRemoveTags: []
    };
    Mautic.basicFroalaOptions.iframeStyle = mQuery.FroalaEditor.DEFAULTS.iframeStyle + 'body .fr-gatedvideo{user-select:none;-o-user-select:none;-moz-user-select:none;-khtml-user-select:none;-webkit-user-select:none;-ms-user-select:none;position:relative;display:table;min-height:140px}body .fr-gatedvideo::after{content:"";position:absolute;background-repeat:no-repeat;background-position:50% 40%;height:100%;width:100%;top:0;left:0;display:block;clear:both;background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHIAAAByCAMAAAC4A3VPAAAA/1BMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD64ociAAAAVHRSTlMAAQIDBAUGCAkKCw0PEBEUFxsfICUmKistLjE1Njo8QExNVl9iY2RmZ2hpa2xtb3Bxc3R8gIWGkZedoquwt8XP0dXX2drc4OLm6Ont7/Hz9ff5+/3esbxfAAACIklEQVRo3u3aW1fTQBSG4a9BKIUKVCi0IqCIp3pAjYpQaEGQYlWk5fv/v8WLrkKbJjNNsmeu9nuXrFnruclhJXsATdM0TdNSVihVqrV6itZXl2ZyeLM7Rz1mqN1YyQaWwltmrrUxDfHgUSUYOdztM1fNBav4rE/+fjI8mjtm3q5rFnFvsK46OFo4p0BPpxHZBADMd0jX5ovhor8AEJxSqLpdJAHgQErkddI19JJjZI1yNePFVxwjC5eCJDesIoEtSZGtGPE1I2RLlOTks+9NZAUWZUU2bCKxLUy2I2JjYgVCYZIzFpE4kSaXLCLRkSZXR8S3cQtwI02uW0RCWhx5zr6jb/I9fZNJojvyA32T+/RNGkRHpEl0QxpFJ+RHeiYff6Jv8oLeSSqppJJKKqmkkkoqqWTe9rveyfrDrncSFtPJl5fZdPN9aTQdfUWbTFf/Cgymsz8i5a53Mtl0+HcryZQn7+dQCSb+SJNVWEycSZMVWEwcSpMlWMy7gZtUvQIsJtaEyaPIBGHSRNCTJXdgM4GvouLtLGwmsCxKhjEzr4gJ4Lug2C/FTfbKvyJk8Z8cuRs/vxwzAWBTTDxOmguPmqaBRurO5zCFOTjxRUTsmHYz3JkX5sFNqk7njfsKhubn4YnN3NfQQWDZPVG+Iskf9zduMd+9cmnbrgGgGP5sPx8bby5/y/zsa20VMm74Cdb2Ds/SvbNvOifh9iI0TdM0TZPtP32lY4xP2bT1AAAAAElFTkSuQmCC)}body .fr-gatedvideo video{background-color:rgba(67,83,147,.5)}body .fr-gatedvideo.fr-active > *{z-index:2;position:relative}body .fr-gatedvideo > *{-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;max-width:100%;border:none}body .fr-box .fr-gatedvideo-resizer{position:absolute;border:solid 1px #1e88e5;display:none;user-select:none;-o-user-select:none;-moz-user-select:none;-khtml-user-select:none;-webkit-user-select:none;-ms-user-select:none}body .fr-box .fr-gatedvideo-resizer.fr-active{display:block}body .fr-box .fr-gatedvideo-resizer .fr-handler{display:block;position:absolute;background:#1e88e5;border:solid 1px #fff;z-index:4;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hnw{cursor:nw-resize}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hne{cursor:ne-resize}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hsw{cursor:sw-resize}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hse{cursor:se-resize}body .fr-box .fr-gatedvideo-resizer .fr-handler{width:12px;height:12px}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hnw{left:-6px;top:-6px}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hne{right:-6px;top:-6px}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hsw{left:-6px;bottom:-6px}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hse{right:-6px;bottom:-6px}@media (min-width: 1200px){body .fr-box .fr-gatedvideo-resizer .fr-handler{width:10px;height:10px}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hnw{left:-5px;top:-5px}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hne{right:-5px;top:-5px}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hsw{left:-5px;bottom:-5px}body .fr-box .fr-gatedvideo-resizer .fr-handler.fr-hse{right:-5px;bottom:-5px}}body .fr-gatedvideo-size-layer .fr-gatedvideo-group .fr-input-line{display:inline-block}body .fr-gatedvideo-size-layer .fr-gatedvideo-group .fr-input-line + .fr-input-line{margin-left:10px}body .fr-gatedvideo-overlay{position:fixed;top:0;left:0;bottom:0;right:0;z-index:9999;display:none}';
    mQuery.FroalaEditor.DEFAULTS.key = 'MCHCPd1XQVZFSHSd1C==';
};
Mautic.initAtWho = function(element, method, froala) {
    if (Mautic.builderTokensRequestInProgress) {
        var intervalID = setInterval(function() {
            if (!Mautic.builderTokensRequestInProgress) {
                clearInterval(intervalID);
                Mautic.configureAtWho(element, method, froala);
            }
        }, 500);
    } else {
        Mautic.configureAtWho(element, method, froala);
    }
};
Mautic.configureAtWho = function(element, method, froala) {
    Mautic.getTokens(method, function(tokens) {
        element.atwho('destroy');
        Mautic.configureDynamicContentAtWhoTokens();
        mQuery.extend(tokens, Mautic.dynamicContentTokens);
        element.atwho({
            at: '{',
            displayTpl: '<li>${name} <small>${id}</small></li>',
            insertTpl: "${id}",
            editableAtwhoQueryAttrs: {
                "data-fr-verified": true
            },
            data: mQuery.map(tokens, function(value, i) {
                return {
                    'id': i,
                    'name': value
                };
            }),
            acceptSpaceBar: true
        });
        if (froala) {
            froala.events.on('keydown', function(e) {
                if ((e.which == mQuery.FroalaEditor.KEYCODE.TAB || e.which == mQuery.FroalaEditor.KEYCODE.ENTER || e.which == mQuery.FroalaEditor.KEYCODE.SPACE) && froala.$el.atwho('isSelecting')) {
                    return false;
                }
            }, true);
        }
    });
};
Mautic.getTokens = function(method, callback) {
    if (!mQuery.isEmptyObject(Mautic.builderTokens)) {
        return callback(Mautic.builderTokens);
    }
    Mautic.builderTokensRequestInProgress = true;
    mQuery.ajax({
        url: mauticAjaxUrl,
        data: 'action=' + method,
        success: function(response) {
            if (typeof response.tokens === 'object') {
                Mautic.builderTokens = response.tokens;
                callback(response.tokens);
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            Mautic.builderTokensRequestInProgress = false;
        }
    });
};
Mautic.configureDynamicContentAtWhoTokens = function() {
    Mautic.dynamicContentTokens = {};
    var dynamicContentTabs = mQuery('#dynamicContentTabs');
    if (dynamicContentTabs.length === 0 && window.parent) {
        dynamicContentTabs = mQuery(window.parent.document.getElementById('dynamicContentTabs'));
    }
    if (dynamicContentTabs.length) {
        dynamicContentTabs.find('a[data-toggle="tab"]').each(function() {
            var tokenText = mQuery(this).text();
            var prototype = '{dynamiccontent="__tokenName__"}';
            var newOption = prototype.replace(/__tokenName__/g, tokenText);
            Mautic.dynamicContentTokens[newOption] = tokenText;
        });
    }
};;
Mautic.overflowNavOptions = {
    "parent": ".nav-overflow-tabs",
    "more": Mautic.translate('mautic.core.tabs.more')
};
Mautic.toggleTabPublished = function(el) {
    if (mQuery(el).val() === "1" && mQuery(el).prop('checked')) {
        Mautic.publishTab(el);
    } else {
        Mautic.unpublishTab(el);
    }
}
Mautic.publishTab = function(tab) {
    mQuery('a[href="#' + Mautic.getTabId(tab) + '"]').find('.fa').removeClass('text-muted').addClass('text-success');
};
Mautic.unpublishTab = function(tab) {
    mQuery('a[href="#' + Mautic.getTabId(tab) + '"]').find('.fa').removeClass('text-success').addClass('text-muted');
};
Mautic.getTabId = function(tab) {
    if (!mQuery(tab).hasClass('tab-pane')) {
        tab = mQuery(tab).closest('.tab-pane');
    }
    return mQuery(tab).attr('id');
};
Mautic.activateOverflowTabs = function(tabs, options) {
    if (!options) {
        options = {};
    }
    var localOptions = Mautic.overflowNavOptions;
    mQuery.extend(localOptions, options);
    mQuery(tabs).overflowNavs(localOptions);
    var resizeMe = function(tabs, options) {
        mQuery(window).on('resize', {
            tabs: tabs,
            options: options
        }, function(event) {
            mQuery(event.data.tabs).overflowNavs(event.data.options);
        });
    };
    resizeMe(tabs, localOptions);
};
Mautic.activateSortableTabs = function(tabs) {
    mQuery(tabs).sortable({
        container: 'ul.nav',
        axis: mQuery(tabs).hasClass('tabs-right') || mQuery(tabs).hasClass('tabs-left') ? 'y' : 'x',
        stop: function(e, ui) {
            var action = mQuery(tabs).attr('data-sort-action');
            mQuery.ajax({
                type: "POST",
                url: action,
                data: mQuery(tabs).sortable("serialize", {
                    attribute: 'data-tab-id'
                })
            });
        }
    });
};
Mautic.activateTabDeleteButtons = function(container) {
    mQuery(container + " .nav.nav-deletable>li a").each(function() {
        Mautic.activateTabDeleteButton(this);
    });
};
Mautic.activateTabDeleteButton = function(tab) {
    var btn = mQuery('<span class="btn btn-danger btn-xs btn-delete pull-right hide"><i class="fa fa-times"></i></span>').on('click', function() {
        return Mautic.deleteTab(btn)
    }).appendTo(tab);
    mQuery(tab).hover(function() {
        mQuery(btn).removeClass('hide');
    }, function() {
        mQuery(btn).addClass('hide');
    });
};
Mautic.deleteTab = function(deleteBtn) {
    var tab = mQuery(deleteBtn).closest('li');
    var tabContent = mQuery(deleteBtn).closest('a').attr('href');
    var parent = mQuery(tab).closest('ul');
    var wasActive = (mQuery(tab.hasClass('active')));
    var action = mQuery(parent).attr('data-delete-action');
    if (action) {
        var success = false;
        mQuery.ajax({
            url: action,
            type: 'POST',
            dataType: "json",
            data: {
                tab: tabContent
            },
            success: function(response) {
                if (response && response.success) {
                    mQuery(tab).remove();
                    mQuery(tabContent).remove();
                    if (wasActive) {
                        mQuery(parent).find('li:first a').click();
                    }
                    if (!mQuery(parent).find('li').length) {
                        mQuery('.tab-content .placeholder').removeClass('hide');
                    }
                } else {
                    Mautic.stopIconSpinPostEvent();
                }
            }
        });
    } else {
        mQuery(tab).remove();
        mQuery(tabContent).remove();
        if (wasActive) {
            mQuery(parent).find('li:first a').click();
        }
        if (!mQuery(parent).find('li').length) {
            mQuery('.tab-content .placeholder').removeClass('hide');
        }
    }
    return false;
};;
Mautic.contentVersions = {};
Mautic.versionNamespace = '';
Mautic.currentContentVersion = -1;
Mautic.prepareVersioning = function(undoCallback, redoCallback, namespace) {
    if (!Mautic.isLocalStorageSupported()) {
        mQuery('.btn-undo').prop('disabled', true);
        mQuery('.btn-redo').prop('disabled', true);
        return;
    }
    mQuery('.btn-undo').prop('disabled', false).on('click', function() {
        Mautic.undoVersion(undoCallback);
    });
    mQuery('.btn-redo').prop('disabled', false).on('click', function() {
        Mautic.redoVersion(redoCallback);
    });
    Mautic.currentContentVersion = -1;
    if (!namespace) {
        namespace = window.location.href;
    }
    if (typeof Mautic.contentVersions[namespace] == 'undefined') {
        Mautic.contentVersions[namespace] = [];
    }
    Mautic.versionNamespace = namespace;
    console.log(namespace);
};
Mautic.clearVersioning = function() {
    if (!Mautic.versionNamespace) {
        throw 'Versioning not configured';
    }
    if (typeof Mautic.contentVersions[Mautic.versionNamespace] !== 'undefined') {
        delete Mautic.contentVersions[Mautic.versionNamespace];
    }
    Mautic.versionNamespace = '';
    Mautic.currentContentVersion = -1;
};
Mautic.storeVersion = function(content) {
    if (!Mautic.versionNamespace) {
        throw 'Versioning not configured';
    }
    Mautic.contentVersions[Mautic.versionNamespace].push(content);
    Mautic.currentContentVersion = Mautic.contentVersions[Mautic.versionNamespace].length;
};
Mautic.undoVersion = function(callback) {
    console.log('undo');
    if (!Mautic.versionNamespace) {
        throw 'Versioning not configured';
    }
    if (Mautic.currentContentVersion < 0) {
        return;
    }
    var version = Mautic.currentContentVersion - 1;
    if (Mautic.getVersion(version, callback)) {
        --Mautic.currentContentVersion;
    };
};
Mautic.redoVersion = function(callback) {
    console.log('redo');
    if (!Mautic.versionNamespace) {
        throw 'Versioning not configured';
    }
    if (Mautic.currentContentVersion < 0 || Mautic.contentVersions[Mautic.versionNamespace].length === Mautic.currentContentVersion) {
        return;
    }
    var version = Mautic.currentContentVersion + 1;
    if (Mautic.getVersion(version, callback)) {
        ++Mautic.currentContentVersion;
    };
};
Mautic.getVersion = function(version, callback) {
    var content = false;
    if (typeof Mautic.contentVersions[Mautic.versionNamespace][version] !== 'undefined') {
        content = Mautic.contentVersions[Mautic.versionNamespace][version];
    }
    if (false !== content && typeof callback == 'function') {
        callback(content);
        return true;
    }
    return false;
};;
Mautic.clientOnLoad = function(container) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'api.client');
    }
};
Mautic.refreshApiClientForm = function(url, modeEl) {
    var mode = mQuery(modeEl).val();
    if (mQuery('#client_redirectUris').length) {
        mQuery('#client_redirectUris').prop('disabled', true);
    } else {
        mQuery('#client_callback').prop('disabled', true);
    }
    mQuery('#client_name').prop('disabled', true);
    Mautic.loadContent(url + '/' + mode);
};;
Mautic.assetOnLoad = function(container) {
    if (typeof mauticAssetUploadEndpoint !== 'undefined' && typeof Mautic.assetDropzone == 'undefined' && mQuery('div#dropzone').length) {
        Mautic.initializeDropzone();
    }
};
Mautic.assetOnUnload = function(id) {
    if (id === '#app-content') {
        delete Mautic.assetDropzone;
    }
};
Mautic.updateRemoteBrowser = function(provider, path) {
    path = typeof path !== 'undefined' ? path : '';
    var spinner = mQuery('<i class="fa fa-fw fa-spinner fa-spin"></i>');
    spinner.appendTo('#tab' + provider + ' a');
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: "action=asset:fetchRemoteFiles&provider=" + provider + "&path=" + path,
        dataType: "json",
        success: function(response) {
            if (response.success) {
                mQuery('div#remoteFileBrowser').html(response.output);
                mQuery('.remote-file-search').quicksearch('#remoteFileBrowser .remote-file-list a');
            } else {}
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            spinner.remove();
        }
    })
};
Mautic.selectRemoteFile = function(url) {
    mQuery('#asset_remotePath').val(url);
    mQuery('#RemoteFileModal').modal('hide');
};
Mautic.changeAssetStorageLocation = function() {
    if (mQuery('#asset_storageLocation_0').prop('checked')) {
        mQuery('#storage-local').removeClass('hide');
        mQuery('#storage-remote').addClass('hide');
        mQuery('#remote-button').addClass('hide');
    } else {
        mQuery('#storage-local').addClass('hide');
        mQuery('#storage-remote').removeClass('hide');
        mQuery('#remote-button').removeClass('hide');
    }
};
Mautic.initializeDropzone = function() {
    var options = {
        url: mauticAssetUploadEndpoint,
        uploadMultiple: false,
        filesizeBase: 1024,
        init: function() {
            this.on("addedfile", function() {
                if (this.files[1] != null) {
                    this.removeFile(this.files[0]);
                }
            });
        }
    };
    if (typeof mauticAssetUploadMaxSize !== 'undefined') {
        options.maxFilesize = mauticAssetUploadMaxSize;
    }
    if (typeof mauticAssetUploadMaxSizeError !== 'undefined') {
        options.dictFileTooBig = mauticAssetUploadMaxSizeError;
    }
    if (typeof mauticAssetUploadExtensions !== 'undefined') {
        options.acceptedFiles = mauticAssetUploadExtensions;
    }
    if (typeof mauticAssetUploadExtensionError !== 'undefined') {
        options.dictInvalidFileType = mauticAssetUploadExtensionError;
    }
    Mautic.assetDropzone = new Dropzone("div#dropzone", options);
    var preview = mQuery('.preview div.text-center');
    Mautic.assetDropzone.on("sending", function(file, request, formData) {
        request.setRequestHeader('X-CSRF-Token', mauticAjaxCsrf);
        formData.append('tempId', mQuery('#asset_tempId').val());
    }).on("addedfile", function(file) {
        preview.fadeOut('fast');
    }).on("success", function(file, response, progress) {
        if (response.tmpFileName) {
            mQuery('#asset_tempName').val(response.tmpFileName);
        }
        var messageArea = mQuery('.mdropzone-error');
        if (response.error || !response.tmpFileName) {
            if (!response.error) {
                var errorText = '';
            } else {
                var errorText = (typeof response.error == 'object') ? response.error.text : response.error;
            }
            messageArea.text(errorText);
            messageArea.closest('.form-group').addClass('has-error').removeClass('is-success');
            var node, _i, _len, _ref, _results;
            file.previewElement.classList.add('dz-error');
            _ref = file.previewElement.querySelectorAll('data-dz-errormessage');
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                node = _ref[_i];
                _results.push(node.textContent = errorText);
            }
            return _results;
        } else {
            messageArea.text('');
            messageArea.closest('.form-group').removeClass('has-error').addClass('is-success');
        }
        var titleInput = mQuery('#asset_title');
        if (file.name && !titleInput.val()) {
            titleInput.val(file.name);
        }
        if (file.name) {
            mQuery('#asset_originalFileName').val(file.name);
        }
    }).on("error", function(file, response) {
        preview.fadeIn('fast');
        var messageArea = mQuery('.mdropzone-error');
        if (typeof response == "string") {
            response = {
                'error': response
            };
        }
        if (response.error) {
            if (!response.error) {
                var errorText = '';
            } else {
                var errorText = (typeof response.error == 'object') ? response.error.text : response.error;
            }
            messageArea.text(errorText);
            messageArea.closest('.form-group').addClass('has-error').removeClass('is-success');
            var node, _i, _len, _ref, _results;
            file.previewElement.classList.add('dz-error');
            _ref = file.previewElement.querySelectorAll('[data-dz-errormessage]');
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                node = _ref[_i];
                _results.push(node.textContent = errorText);
            }
            return _results;
        }
    }).on("thumbnail", function(file, url) {
        if (file.accepted === true) {
            var extension = file.name.substr((file.name.lastIndexOf('.') + 1)).toLowerCase();
            var previewContent = '';
            if (mQuery.inArray(extension, ['jpg', 'jpeg', 'gif', 'png']) !== -1) {
                previewContent = mQuery('<img />').addClass('img-thumbnail').attr('src', url);
            } else if (extension === 'pdf') {
                previewContent = mQuery('<iframe />').attr('src', url);
            }
            preview.empty().html(previewContent);
            preview.fadeIn('fast');
        }
    });
};
Mautic.calendarOnLoad = function(container) {
    Mautic.loadCalendarEvents(container);
};
Mautic.calendarModalOnLoad = function(container, response) {
    mQuery('#calendar').fullCalendar('refetchEvents');
    mQuery(container + " a[data-toggle='ajax']").off('click.ajax');
    mQuery(container + " a[data-toggle='ajax']").on('click.ajax', function(event) {
        event.preventDefault();
        mQuery('.modal').modal('hide');
        return Mautic.ajaxifyLink(this, event);
    });
};
Mautic.initializeCalendarModals = function(container) {
    mQuery(container + " *[data-toggle='ajaxmodal']").off('click.ajaxmodal');
    mQuery(container + " *[data-toggle='ajaxmodal']").on('click.ajaxmodal', function(event) {
        event.preventDefault();
        Mautic.ajaxifyModal(this, event);
    });
}
Mautic.loadCalendarEvents = function(container) {
    mQuery('#calendar').fullCalendar({
        events: mauticAjaxUrl + "?action=calendar:generateData",
        lang: 'en',
        eventLimit: true,
        eventLimitText: "more",
        eventRender: function(event, element) {
            element = mQuery(element);
            if (event.iconClass) {
                element.find('.fc-title').before(mQuery('<i />').addClass(event.iconClass));
            }
            if (event.attr) {
                element.attr(event.attr);
            }
            if (event.description) {
                var checkDay = new Date(event.start._d);
                if (checkDay.getDay() == 0) {
                    element.tooltip({
                        'title': event.description,
                        placement: 'right'
                    });
                } else {
                    element.tooltip({
                        'title': event.description,
                        placement: 'left'
                    });
                }
            }
        },
        loading: function(bool) {
            if (!bool) {
                Mautic.initializeCalendarModals(container);
            }
        },
        eventDrop: function(event, delta, revertFunc) {
            mQuery.ajax({
                url: mauticAjaxUrl + "?action=calendar:updateEvent",
                data: 'entityId=' + event.entityId + '&entityType=' + event.entityType + '&setter=' + event.setter + '&startDate=' + event.start.format(),
                type: "POST",
                dataType: "json",
                success: function(response) {
                    if (!response.success) {
                        revertFunc();
                    }
                    Mautic.initializeCalendarModals(container);
                    if (response.flashes) {
                        Mautic.setFlashes(response.flashes);
                        Mautic.hideFlashes();
                    }
                },
                error: function(response, textStatus, errorThrown) {
                    revertFunc();
                    Mautic.processAjaxError(response, textStatus, errorThrown, true);
                }
            });
        }
    });
};
Mautic.campaignOnLoad = function(container, response) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'campaign');
    }
    if (mQuery('#CampaignEventPanel').length) {
        mQuery('#CampaignEventPanelGroups button').on('click', function() {
            var eventType = mQuery(this).data('type');
            Mautic.campaignBuilderUpdateEventList([eventType], false, 'lists', true);
        });
        mQuery('#CampaignEventPanelLists button').on('click', function() {
            Mautic.campaignBuilderUpdateEventList(Mautic.campaignBuilderAnchorClickedAllowedEvents, true, 'groups', true);
        });
        if (!(mQuery('.preview').length)) {
            mQuery('#CampaignCanvas .list-campaign-event, #CampaignCanvas .list-campaign-source').off('.eventbuttons').on('mouseover.eventbuttons', function() {
                mQuery(this).find('.campaign-event-buttons').removeClass('hide');
            }).on('mouseout.eventbuttons', function() {
                mQuery(this).find('.campaign-event-buttons').addClass('hide');
            }).on('dblclick.eventbuttons', function(event) {
                event.preventDefault();
                mQuery(this).find('.btn-edit').first().click();
            });
        } else {
            mQuery("#CampaignCanvas div.list-campaign-event").each(function() {
                var thisId = mQuery(this).attr('id');
                var option = mQuery('#' + thisId + ' option[value="' + mQuery(this).val() + '"]');
            });
        }
        mQuery('.campaign-event-selector').on('chosen:showing_dropdown', function(event) {
            mQuery('.builder-content').css('overflow', 'hidden');
            var thisSelect = mQuery(event.target).attr('id');
            Mautic.campaignBuilderUpdateEventListTooltips(thisSelect, false);
            mQuery('#' + thisSelect + '_chosen .chosen-search input').on('keydown.tooltip', function() {
                Mautic.campaignBuilderUpdateEventListTooltips(thisSelect, true);
            }).on('keyup.tooltip', function() {
                Mautic.campaignBuilderUpdateEventListTooltips(thisSelect, false);
            });
        });
        mQuery('.campaign-event-selector').on('chosen:hiding_dropdown', function(event) {
            mQuery('.builder-content').css('overflow', 'auto');
            var thisSelect = mQuery(event.target).attr('id');
            Mautic.campaignBuilderUpdateEventListTooltips(thisSelect, true);
            mQuery('#' + thisSelect + '_chosen .chosen-search input').off('keyup.tooltip').off('keydown.tooltip');
        });
        mQuery('.campaign-event-selector').on('change', function() {
            if (!mQuery('#CampaignEvent_newsource').length) {
                mQuery('#CampaignEventPanel').addClass('hide');
            }
            var thisId = mQuery(this).attr('id');
            var option = mQuery('#' + thisId + ' option[value="' + mQuery(this).val() + '"]');
            if (option.attr('data-href') && Mautic.campaignBuilderAnchorNameClicked) {
                var updatedUrl = option.attr('data-href').replace(/anchor=(.*?)$/, "anchor=" + Mautic.campaignBuilderAnchorNameClicked + "&anchorEventType=" + Mautic.campaignBuilderAnchorEventTypeClicked);
                option.attr('data-href', updatedUrl);
            }
            mQuery('#' + thisId).trigger('chosen:close');
            Mautic.ajaxifyModal(option);
            mQuery(this).val('');
            mQuery(this).trigger('chosen:updated');
        });
        mQuery('#CampaignCanvas').on('click', function(event) {
            if (!mQuery(event.target).parents('#CampaignCanvas').length && !mQuery('#CampaignEvent_newsource').length) {
                mQuery('#CampaignEventPanel').addClass('hide');
            }
        });
        Mautic.prepareCampaignCanvas();
        if (response && response.inBuilder) {
            Mautic.launchCampaignEditor();
            Mautic.processBuilderErrors(response);
        }
    }
};
Mautic.campaignBuilderUpdateEventListTooltips = function(theSelect, destroy) {
    mQuery('#' + theSelect + ' option').each(function() {
        if (mQuery(this).attr('id')) {
            var chosenOption = '#' + theSelect + '_chosen .option_' + mQuery(this).attr('id');
            if (destroy) {
                mQuery(chosenOption).tooltip('destroy');
            } else {
                mQuery(chosenOption).tooltip({
                    html: true,
                    container: 'body',
                    placement: 'left'
                });
            }
        }
    });
}
Mautic.campaignOnUnload = function(container) {
    delete Mautic.campaignBuilderInstance;
    delete Mautic.campaignBuilderLabels;
}
Mautic.campaignEventOnLoad = function(container, response) {
    if (mQuery('#campaignevent_triggerHour').length) {
        Mautic.campaignEventShowHideIntervalSettings();
        Mautic.campaignEventUpdateIntervalHours();
        mQuery('#campaignevent_triggerHour').on('change', Mautic.campaignEventUpdateIntervalHours);
        mQuery('#campaignevent_triggerRestrictedStartHour').on('change', Mautic.campaignEventUpdateIntervalHours);
        mQuery('#campaignevent_triggerRestrictedStopHour').on('change', Mautic.campaignEventUpdateIntervalHours);
        mQuery('#campaignevent_triggerIntervalUnit').on('change', Mautic.campaignEventShowHideIntervalSettings);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_0').on('change', Mautic.campaignEventSelectDOW);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_1').on('change', Mautic.campaignEventSelectDOW);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_2').on('change', Mautic.campaignEventSelectDOW);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_3').on('change', Mautic.campaignEventSelectDOW);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_4').on('change', Mautic.campaignEventSelectDOW);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_7').on('change', Mautic.campaignEventSelectDOW);
    }
    if (!response.hasOwnProperty('eventId')) {
        return;
    }
    var domEventId = 'CampaignEvent_' + response.eventId;
    var eventId = '#' + domEventId;
    Mautic.campaignBuilderLabels[domEventId] = (response.label) ? response.label : '';
    if (!response.success && Mautic.campaignBuilderConnectionRequiresUpdate) {
        Mautic.campaignBuilderInstance.deleteConnection(Mautic.campaignBuilderLastConnection);
    }
    Mautic.campaignBuilderConnectionRequiresUpdate = false;
    Mautic.campaignBuilderUpdateLabel(domEventId);
    Mautic.campaignBuilderCanvasEvents[response.event.id] = response.event;
    if (response.deleted) {
        Mautic.campaignBuilderInstance.remove(document.getElementById(domEventId));
        delete Mautic.campaignBuilderEventPositions[domEventId];
        delete Mautic.campaignBuilderCanvasEvents[response.event.id];
    } else if (response.updateHtml) {
        mQuery(eventId + " .campaign-event-content").replaceWith(response.updateHtml);
    } else if (response.eventHtml) {
        var newHtml = response.eventHtml;
        var x = parseInt(mQuery('#droppedX').val());
        var y = parseInt(mQuery('#droppedY').val());
        Mautic.campaignBuilderEventPositions[domEventId] = {
            'left': x,
            'top': y
        };
        mQuery(newHtml).appendTo('#CampaignCanvas');
        mQuery(eventId).css({
            'left': x + 'px',
            'top': y + 'px'
        });
        Mautic.campaignBuilderRegisterAnchors(Mautic.getAnchorsForEvent(response.event), eventId);
        Mautic.campaignBuilderInstance.draggable(domEventId, Mautic.campaignDragOptions);
        mQuery(eventId + " a[data-toggle='ajax']").click(function(event) {
            event.preventDefault();
            return Mautic.ajaxifyLink(this, event);
        });
        mQuery(eventId + " a[data-toggle='ajaxmodal']").on('click.ajaxmodal', function(event) {
            event.preventDefault();
            Mautic.ajaxifyModal(this, event);
        });
        mQuery(eventId).off('.eventbuttons').on('mouseover.eventbuttons', function() {
            mQuery(this).find('.campaign-event-buttons').removeClass('hide');
        }).on('mouseout.eventbuttons', function() {
            mQuery(this).find('.campaign-event-buttons').addClass('hide');
        }).on('dblclick.eventbuttons', function(event) {
            event.preventDefault();
            mQuery(this).find('.btn-edit').first().click();
        });
        mQuery(eventId + " *[data-toggle='tooltip']").tooltip({
            html: true
        });
        Mautic.campaignBuilderInstance.connect({
            uuids: [Mautic.campaignBuilderAnchorClicked, domEventId + '_top']
        });
    }
    Mautic.campaignBuilderInstance.repaintEverything();
};
Mautic.campaignEventUpdateIntervalHours = function() {
    var hour = mQuery('#campaignevent_triggerHour').val();
    var start = mQuery('#campaignevent_triggerRestrictedStartHour').val();
    var stop = mQuery('#campaignevent_triggerRestrictedStopHour').val();
    if (hour) {
        mQuery('#campaignevent_triggerRestrictedStartHour').val('');
        mQuery('#campaignevent_triggerRestrictedStopHour').val('');
        mQuery('#campaignevent_triggerRestrictedStartHour').prop('disabled', true);
        mQuery('#campaignevent_triggerRestrictedStopHour').prop('disabled', true);
    } else if (start || stop) {
        mQuery('#campaignevent_triggerHour').val('');
        mQuery('#campaignevent_triggerHour').prop('disabled', true);
    } else {
        mQuery('#campaignevent_triggerHour').val('');
        mQuery('#campaignevent_triggerRestrictedStartHour').val('');
        mQuery('#campaignevent_triggerRestrictedStopHour').val('');
        mQuery('#campaignevent_triggerHour').prop('disabled', false);
        mQuery('#campaignevent_triggerRestrictedStartHour').prop('disabled', false);
        mQuery('#campaignevent_triggerRestrictedStopHour').prop('disabled', false);
    }
};
Mautic.campaignEventShowHideIntervalSettings = function() {
    var unit = mQuery('#campaignevent_triggerIntervalUnit').val();
    if (unit === 'i' || unit === 'h') {
        mQuery('#interval_settings').addClass('hide');
    } else {
        mQuery('#interval_settings').removeClass('hide');
    }
};
Mautic.campaignEventSelectDOW = function() {
    if (mQuery('#campaignevent_triggerRestrictedDaysOfWeek_7').prop('checked')) {
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_0').prop('checked', true);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_1').prop('checked', true);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_2').prop('checked', true);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_3').prop('checked', true);
        mQuery('#campaignevent_triggerRestrictedDaysOfWeek_4').prop('checked', true);
    }
    mQuery('#campaignevent_triggerRestrictedDaysOfWeek_7').prop('checked', false);
};
Mautic.getAnchorsForEvent = function(event) {
    var restrictions = Mautic.campaignBuilderConnectionRestrictions[event.type].target;
    if (restrictions.decision.length === 1 && restrictions.decision[0] === "none" && restrictions.action.length === 1 && restrictions.action[0] === "none" && restrictions.condition.length === 1 && restrictions.condition[0] === "none") {
        return ['top'];
    }
    if (event.eventType === 'decision' || event.eventType === 'condition') {
        return ['top', 'yes', 'no'];
    }
    return ['top', 'bottom'];
};
Mautic.campaignSourceOnLoad = function(container, response) {
    var domEventId = 'CampaignEvent_' + response.sourceType;
    var eventId = '#' + domEventId;
    if (response.deleted) {
        Mautic.campaignBuilderInstance.remove(document.getElementById(domEventId));
        delete Mautic.campaignBuilderEventPositions[domEventId];
        mQuery('#campaignLeadSource_' + response.sourceType).prop('disabled', false);
        mQuery('#SourceList').trigger('chosen:updated');
        if (!mQuery('.list-campaign-source:not(#CampaignEvent_newsource_hide)').length) {
            mQuery('#CampaignEvent_newsource_hide').attr('id', 'CampaignEvent_newsource');
            Mautic.campaignBuilderPrepareNewSource();
        }
    } else if (response.updateHtml) {
        mQuery(eventId + " .campaign-event-content").html(response.updateHtml);
    } else if (response.sourceHtml) {
        mQuery('#campaignLeadSource_' + response.sourceType).prop('disabled', true);
        mQuery('#SourceList').trigger('chosen:updated');
        var newHtml = response.sourceHtml;
        if (mQuery('#CampaignEvent_newsource').length) {
            var x = mQuery('#CampaignEvent_newsource').position().left;
            var y = mQuery('#CampaignEvent_newsource').position().top;
            mQuery('#CampaignEvent_newsource').attr('id', 'CampaignEvent_newsource_hide');
            mQuery('#CampaignEventPanel').addClass('hide');
            var autoConnect = false;
        } else {
            var x = parseInt(mQuery('#droppedX').val());
            var y = parseInt(mQuery('#droppedY').val());
            var autoConnect = true;
        }
        mQuery(newHtml).appendTo('#CampaignCanvas');
        Mautic.campaignBuilderEventPositions[domEventId] = {
            'left': x,
            'top': y
        };
        mQuery(eventId).css({
            'left': x + 'px',
            'top': y + 'px'
        });
        Mautic.campaignBuilderRegisterAnchors(['leadSource', 'leadSourceLeft', 'leadSourceRight'], eventId);
        Mautic.campaignBuilderInstance.draggable(domEventId, Mautic.campaignDragOptions);
        mQuery(eventId + " a[data-toggle='ajax']").click(function(event) {
            event.preventDefault();
            return Mautic.ajaxifyLink(this, event);
        });
        mQuery(eventId + " a[data-toggle='ajaxmodal']").on('click.ajaxmodal', function(event) {
            event.preventDefault();
            Mautic.ajaxifyModal(this, event);
        });
        mQuery(eventId).off('.eventbuttons').on('mouseover.eventbuttons', function() {
            mQuery(this).find('.campaign-event-buttons').removeClass('hide');
        }).on('mouseout.eventbuttons', function() {
            mQuery(this).find('.campaign-event-buttons').addClass('hide');
        }).on('dblclick.eventbuttons', function(event) {
            event.preventDefault();
            mQuery(this).find('.btn-edit').first().click();
        });
        mQuery(eventId + " *[data-toggle='tooltip']").tooltip({
            html: true
        });
        if (autoConnect) {
            if (Mautic.campaignBuilderAnchorClicked.search('left') !== -1) {
                var source = domEventId + '_leadsourceright';
                var target = Mautic.campaignBuilderAnchorClicked;
            } else {
                var source = Mautic.campaignBuilderAnchorClicked;
                var target = domEventId + '_leadsourceleft';
            }
            Mautic.campaignBuilderInstance.connect({
                uuids: [source, target]
            });
        }
        if (!mQuery('.list-campaign-event').length) {
            mQuery('.jtk-endpoint_anchor_leadsource.' + domEventId).trigger('click');
        }
    }
    Mautic.campaignBuilderInstance.repaintEverything();
};
Mautic.campaignBuilderUpdateLabel = function(domEventId) {
    var theLabel = typeof Mautic.campaignBuilderLabels[domEventId] == 'undefined' ? '' : Mautic.campaignBuilderLabels[domEventId];
    var currentConnections = Mautic.campaignBuilderInstance.select({
        target: domEventId
    });
    if (currentConnections.length > 0) {
        currentConnections.each(function(conn) {
            var overlays = conn.getOverlays();
            if (overlays.length > 0) {
                for (var i = 0; i <= overlays.length; i++) {
                    if (typeof overlays[i] != 'undefined' && overlays[i].type == 'Label') {
                        conn.removeOverlay(overlays[i].id);
                    }
                }
            }
            if (theLabel) {
                conn.addOverlay(["Label", {
                    label: theLabel,
                    location: 0.65,
                    cssClass: "jtk-label",
                    id: conn.sourceId + "_" + conn.targetId + "_connectionLabel"
                }]);
            }
        });
    }
};
Mautic.launchCampaignEditor = function() {
    Mautic.stopIconSpinPostEvent();
    mQuery('body').css('overflow-y', 'hidden');
    mQuery('.builder').addClass('builder-active').removeClass('hide');
    if (mQuery('#CampaignEvent_newsource').length) {
        Mautic.campaignBuilderPrepareNewSource();
    }
    if (Mautic.campaignBuilderCanvasSettings) {
        Mautic.campaignBuilderInstance.setSuspendDrawing(true);
        Mautic.campaignBuilderReconnectEndpoints();
        Mautic.campaignBuilderInstance.setSuspendDrawing(false, true);
    }
    Mautic.campaignBuilderInstance.repaintEverything();
};
Mautic.launchCampaignPreview = function() {
    Mautic.stopIconSpinPostEvent();
    if (Mautic.campaignBuilderCanvasSettings) {
        Mautic.campaignBuilderInstance.setSuspendDrawing(true);
        Mautic.campaignBuilderReconnectEndpoints();
        Mautic.campaignBuilderInstance.setSuspendDrawing(false, true);
    }
    Mautic.campaignBuilderInstance.repaintEverything();
};
Mautic.campaignBuilderConnectionsMap = {
    'source': {
        'leadsource': {
            'source': [],
            'action': ['top'],
            'condition': ['top'],
            'decision': ['top'],
        },
        'leadsourceleft': {
            'source': ['leadsourceright'],
            'action': [],
            'condition': [],
            'decision': []
        },
        'leadsourceright': {
            'source': ['leadsourceleft'],
            'action': [],
            'condition': [],
            'decision': []
        }
    },
    'action': {
        'top': {
            'source': ['leadsource'],
            'action': ['bottom'],
            'condition': ['yes', 'no'],
            'decision': ['yes', 'no']
        },
        'bottom': {
            'source': [],
            'action': ['top'],
            'condition': ['top'],
            'decision': ['top']
        }
    },
    'condition': {
        'top': {
            'source': ['leadsource'],
            'action': ['bottom'],
            'condition': ['yes', 'no'],
            'decision': ['yes', 'no']
        },
        'yes': {
            'source': [],
            'action': ['top'],
            'condition': ['top'],
            'decision': ['top']
        },
        'no': {
            'source': [],
            'action': ['top'],
            'condition': ['top'],
            'decision': ['top']
        }
    },
    'decision': {
        'top': {
            'action': ['bottom'],
            'source': ['leadsource'],
            'condition': ['yes', 'no'],
            'decision': [],
        },
        'yes': {
            'source': [],
            'action': ['top'],
            'condition': ['top'],
            'decision': [],
        },
        'no': {
            'source': [],
            'action': ['top'],
            'condition': ['top'],
            'decision': [],
        }
    }
};
Mautic.campaignBuilderAnchorDefaultColor = '#d5d4d4';
Mautic.campaignEndpointDefinitions = {
    'top': {
        anchors: [0.5, 0, 0, -1, 0, 0],
        isTarget: true
    },
    'bottom': {
        anchors: [0.5, 1, 0, 1, 0, 0],
        isTarget: false
    },
    'yes': {
        anchors: [0, 1, 0, 1, 30, 0],
        connectorColor: '#00b49c',
        isTarget: false
    },
    'no': {
        anchors: [1, 1, 0, 1, -30, 0],
        connectorColor: '#f86b4f',
        isTarget: false
    },
    'leadSource': {
        anchors: [0.5, 1, 0, 1, 0, 0],
        isTarget: false
    },
    'leadSourceLeft': {
        anchors: [0, 0.5, -1, 0, -1, 0],
        connectorColor: '#fdb933',
        isTarget: true,
        connectorStyle: 'Straight'
    },
    'leadSourceRight': {
        anchors: [1, 0.5, 1, 0, 1, 0],
        connectorColor: '#fdb933',
        isTarget: false,
        connectorStyle: 'Straight'
    }
};
Mautic.campaignConnectionCallbacks = {
    'beforeDetach': [],
    'beforeDrag': [],
    'beforeStartDetach': [],
    'beforeDrop': [],
    'onHover': [],
    'beforeAnchorsRegistered': [],
    'afterAnchorsRegistered': [],
    'beforeEndpointsRegistered': [],
    'beforeEndpointsReconnected': [],
    'afterEndpointsReconnected': []
};
Mautic.campaignBuilderAnchorClicked = false;
Mautic.campaignBuilderEventPositions = {};
Mautic.prepareCampaignCanvas = function() {
    if (typeof Mautic.campaignBuilderInstance == 'undefined') {
        Mautic.campaignBuilderInstance = jsPlumb.getInstance({
            Container: document.querySelector("#CampaignCanvas")
        });
        Mautic.campaignEndpoints = {};
        var startingPosition;
        Mautic.campaignDragOptions = {
            start: function(params) {
                startingPosition = {
                    top: params.el.offsetTop,
                    left: params.el.offsetLeft,
                };
            },
            stop: function(params) {
                var endingPosition = {
                    top: params.finalPos[0],
                    left: params.finalPos[1]
                };
                if (startingPosition.left !== endingPosition.left || startingPosition.top !== endingPosition.top) {
                    Mautic.campaignBuilderEventPositions[mQuery(params.el).attr('id')] = {
                        'left': parseInt(endingPosition.left),
                        'top': parseInt(endingPosition.top)
                    };
                    var campaignId = mQuery('#campaignId').val();
                    var query = "action=campaign:updateCoordinates&campaignId=" + campaignId + "&droppedX=" + endingPosition.top + "&droppedY=" + endingPosition.left + "&eventId=" + mQuery(params.el).attr('id');
                    mQuery.ajax({
                        url: mauticAjaxUrl,
                        type: "POST",
                        data: query,
                        dataType: "json",
                        error: function(request, textStatus, errorThrown) {
                            Mautic.processAjaxError(request, textStatus, errorThrown);
                        }
                    });
                }
            },
            containment: true
        };
        Mautic.campaignBuilderEventDimensions = {
            'width': 200,
            'height': 45,
            'anchor': 10,
            'wiggleWidth': 30,
            'wiggleHeight': 50
        };
        Mautic.campaignBuilderLabels = {};
        Mautic.campaignBuilderInstance.bind("connection", function(info, originalEvent) {
            Mautic.campaignBuilderConnectionRequiresUpdate = false;
            Mautic.campaignBuilderLastConnection = info.connection;
            var epDetails = Mautic.campaignBuilderGetEndpointDetails(info.sourceEndpoint);
            var targetElementId = info.targetEndpoint.elementId;
            var previousConnection = mQuery('#' + targetElementId).attr('data-connected');
            var editButton = mQuery('#' + targetElementId).find('a.btn-edit');
            var editUrl = editButton.attr('href');
            if (editUrl) {
                var anchorQueryParams = 'anchor=' + epDetails.anchorName + "&anchorEventType=" + epDetails.eventType;
                if (editUrl.search('anchor=') !== -1) {
                    editUrl.replace(/anchor=(.*?)$/, anchorQueryParams);
                } else {
                    var delimiter = (editUrl.indexOf('?') === -1) ? '?' : '&';
                    editUrl = editUrl + delimiter + anchorQueryParams;
                }
                editButton.attr('data-href', editUrl);
                if (previousConnection && previousConnection != epDetails.anchorName && (previousConnection == 'no' || epDetails.anchorName == 'no')) {
                    editButton.attr('data-prevent-dismiss', true);
                    Mautic.campaignBuilderConnectionRequiresUpdate = true;
                    editButton.trigger('click');
                }
            }
            mQuery('#' + targetElementId).attr('data-connected', epDetails.anchorName);
            Mautic.campaignBuilderUpdateLabel(info.connection.targetId);
            info.targetEndpoint.setPaintStyle({
                fill: info.connection.getPaintStyle().stroke
            });
            info.sourceEndpoint.setPaintStyle({
                fill: info.connection.getPaintStyle().stroke
            });
        });
        Mautic.campaignBuilderInstance.bind("connectionDetached", function(info, originalEvent) {
            Mautic.campaignBuilderUpdateLabel(info.connection.targetId);
            info.targetEndpoint.setPaintStyle({
                fill: "#d5d4d4"
            });
            var currentConnections = info.sourceEndpoint.connections.length;
            currentConnections -= 1;
            if (!currentConnections) {
                info.sourceEndpoint.setPaintStyle({
                    fill: "#d5d4d4"
                });
            }
        });
        Mautic.campaignBuilderInstance.bind("connectionMoved", function(info, originalEvent) {
            Mautic.campaignBuilderUpdateLabel(info.connection.originalTargetId);
            info.originalTargetEndpoint.setPaintStyle({
                fill: "#d5d4d4"
            });
            Mautic.campaignBuilderUpdateLabel(info.connection.newTargetId);
            info.newTargetEndpoint.setPaintStyle({
                fill: info.newSourceEndpoint.getPaintStyle().fill
            });
        });
        mQuery('.builder-content').scroll(function() {
            Mautic.campaignBuilderInstance.repaintEverything();
        });
        mQuery.each(Mautic.campaignConnectionCallbacks.beforeEndpointsRegistered, function(index, callback) {
            callback();
        });
        mQuery.each(Mautic.campaignEndpointDefinitions, function(ep, definition) {
            Mautic.campaignBuilderRegisterEndpoint(ep, definition);
        });
        mQuery.each(Mautic.campaignConnectionCallbacks.beforeAnchorsRegistered, function(index, callback) {
            callback();
        });
        mQuery("#CampaignCanvas div[data-event-id]").each(function() {
            var event = Mautic.campaignBuilderCanvasEvents[mQuery(this).data('eventId')];
            Mautic.campaignBuilderRegisterAnchors(Mautic.getAnchorsForEvent(event), this);
        });
        mQuery("#CampaignCanvas div.list-campaign-event.list-campaign-source").not('#CampaignEvent_newsource').not('#CampaignEvent_newsource_hide').each(function() {
            Mautic.campaignBuilderRegisterAnchors(['bottom'], this);
        });
        mQuery("#CampaignCanvas div.list-campaign-leadsource").not('#CampaignEvent_newsource').not('#CampaignEvent_newsource_hide').each(function() {
            Mautic.campaignBuilderRegisterAnchors(['leadSource', 'leadSourceLeft', 'leadSourceRight'], this);
        });
        mQuery.each(Mautic.campaignConnectionCallbacks.afterAnchorsRegistered, function(index, callback) {
            callback();
        });
        if (mQuery('.preview').length) {
            Mautic.launchCampaignPreview();
        } else {
            Mautic.campaignBuilderInstance.draggable(document.querySelectorAll("#CampaignCanvas .draggable"), Mautic.campaignDragOptions);
        }
    }
};
Mautic.campaignBeforeDropCallback = function(params) {
    var sourceEndpoint = Mautic.campaignBuilderGetEndpointDetails(params.connection.endpoints[0]);
    var targetEndpoint = Mautic.campaignBuilderGetEndpointDetails(params.dropEndpoint);
    var callbackAllowed = null;
    mQuery.each(Mautic.campaignConnectionCallbacks.beforeDrop, function(index, callback) {
        var result = callback(sourceEndpoint, targetEndpoint, params);
        if (null !== result) {
            callbackAllowed = result;
            return false;
        }
    });
    if (null !== callbackAllowed) {
        return callbackAllowed;
    }
    if (!Mautic.campaignBuilderValidateConnection(sourceEndpoint, targetEndpoint.eventType, targetEndpoint.event)) {
        return false;
    }
    if (mQuery.inArray(targetEndpoint.anchorName, ['top', 'leadsourceleft', 'leadsourceright'])) {
        var sourceConnections = Mautic.campaignBuilderInstance.select({
            source: params.targetId
        });
        var loopDetected = false;
        sourceConnections.each(function(conn) {
            if (conn.sourceId == targetEndpoint.elementId && conn.targetId == sourceEndpoint.elementId) {
                loopDetected = true;
                return false;
            }
        });
    }
    if (params.sourceId == params.targetId) {
        return false;
    }
    var allowedConnections = Mautic.campaignBuilderConnectionsMap[sourceEndpoint.eventType][sourceEndpoint.anchorName][targetEndpoint.eventType];
    var allowed = mQuery.inArray(targetEndpoint.anchorName, allowedConnections) !== -1;
    if (allowed) {
        if (params.dropEndpoint.connections.length > 0) {
            mQuery.each(params.dropEndpoint.connections, function(key, conn) {
                Mautic.campaignBuilderInstance.deleteConnection(conn);
            });
        }
    }
    return allowed;
};
Mautic.campaignBeforeDetachCallback = function(connection) {
    var sourceEndpoint = Mautic.campaignBuilderGetEndpointDetails(connection.sourceId);
    var targetEndpoint = Mautic.campaignBuilderGetEndpointDetails(connection.targetId);
    var callbackAllowed = null;
    mQuery.each(Mautic.campaignConnectionCallbacks.beforeDetach, function(index, callback) {
        var result = callback(sourceEndpoint, targetEndpoint, connection);
        if (null !== result) {
            callbackAllowed = result;
            return false;
        }
    });
    if (null !== callbackAllowed) {
        return callbackAllowed;
    }
    return true;
};
Mautic.campaignBeforeDragCallback = function(endpoint, source, sourceId) {
    var sourceEndpoint = Mautic.campaignBuilderGetEndpointDetails(sourceId);
    var targetEndpoint = Mautic.campaignBuilderGetEndpointDetails(endpoint);
    var callbackAllowed = null;
    mQuery.each(Mautic.campaignConnectionCallbacks.beforeDrag, function(index, callback) {
        var result = callback(sourceEndpoint, targetEndpoint, endpoint, source, sourceId);
        if (null !== result) {
            callbackAllowed = result;
            return false;
        }
    });
    if (null !== callbackAllowed) {
        return callbackAllowed;
    }
    return true;
};
Mautic.campaignBeforeStartDetachCallback = function(endpoint, source, sourceId, connection) {
    var sourceEndpoint = Mautic.campaignBuilderGetEndpointDetails(sourceId);
    var targetEndpoint = Mautic.campaignBuilderGetEndpointDetails(endpoint);
    var callbackAllowed = null;
    mQuery.each(Mautic.campaignConnectionCallbacks.beforeStartDetach, function(index, callback) {
        var result = callback(sourceEndpoint, targetEndpoint, endpoint, source, sourceId, connection);
        if (null !== result) {
            callbackAllowed = result;
            return false;
        }
    });
    if (null !== callbackAllowed) {
        return callbackAllowed;
    }
    return true;
};
Mautic.campaignHoverCallback = function(sourceEndpoint, endpoint, event) {
    var callbackAllowed = null;
    mQuery.each(Mautic.campaignConnectionCallbacks.onHover, function(index, callback) {
        var result = callback(sourceEndpoint, endpoint, event);
        if (null !== result) {
            callbackAllowed = result;
            return false;
        }
    });
    if (null !== callbackAllowed) {
        return callbackAllowed;
    }
    return true;
};
Mautic.campaignToggleTimeframes = function() {
    if (mQuery('#campaignevent_triggerMode_2').length) {
        var immediateChecked = mQuery('#campaignevent_triggerMode_0').prop('checked');
        var intervalChecked = mQuery('#campaignevent_triggerMode_1').prop('checked');
        var dateChecked = mQuery('#campaignevent_triggerMode_2').prop('checked');
    } else {
        var immediateChecked = false;
        var intervalChecked = mQuery('#campaignevent_triggerMode_0').prop('checked');
        var dateChecked = mQuery('#campaignevent_triggerMode_1').prop('checked');
    }
    if (mQuery('#campaignevent_triggerInterval').length) {
        if (immediateChecked) {
            mQuery('#triggerInterval').addClass('hide');
            mQuery('#triggerDate').addClass('hide');
        } else if (intervalChecked) {
            mQuery('#triggerInterval').removeClass('hide');
            mQuery('#triggerDate').addClass('hide');
        } else if (dateChecked) {
            mQuery('#triggerInterval').addClass('hide');
            mQuery('#triggerDate').removeClass('hide');
        }
    }
};
Mautic.closeCampaignBuilder = function() {
    var builderCss = {
        margin: "0",
        padding: "0",
        border: "none",
        width: "100%",
        height: "100%"
    };
    var panelHeight = (mQuery('.builder-content').css('right') == '0px') ? mQuery('.builder-panel').height() : 0,
        panelWidth = (mQuery('.builder-content').css('right') == '0px') ? 0 : mQuery('.builder-panel').width(),
        spinnerLeft = (mQuery(window).width() - panelWidth - 60) / 2,
        spinnerTop = (mQuery(window).height() - panelHeight - 60) / 2;
    var overlay = mQuery('<div id="builder-overlay" class="modal-backdrop fade in"><div style="position: absolute; top:' + spinnerTop + 'px; left:' + spinnerLeft + 'px" class=".builder-spinner"><i class="fa fa-spinner fa-spin fa-5x"></i></div></div>').css(builderCss).appendTo('.builder-content');
    mQuery('.btn-close-builder').prop('disabled', true);
    Mautic.removeButtonLoadingIndicator(mQuery('.btn-apply-builder'));
    mQuery('#builder-errors').hide('fast').text('');
    Mautic.updateConnections(function(err, response) {
        mQuery('body').css('overflow-y', '');
        if (!err) {
            mQuery('#builder-overlay').remove();
            mQuery('body').css('overflow-y', '');
            if (response.success) {
                mQuery('.builder').addClass('hide').removeClass('builder-active');
            }
            mQuery('.btn-close-builder').prop('disabled', false);
        }
    });
};
Mautic.saveCampaignFromBuilder = function() {
    Mautic.activateButtonLoadingIndicator(mQuery('.btn-apply-builder'));
    Mautic.updateConnections(function(err) {
        if (!err) {
            var applyBtn = mQuery('.btn-apply');
            Mautic.inBuilderSubmissionOn(applyBtn.closest('form'));
            applyBtn.trigger('click');
            Mautic.inBuilderSubmissionOff();
        }
    });
};
Mautic.updateConnections = function(callback) {
    var nodes = [];
    mQuery("#CampaignCanvas .list-campaign-event").each(function(idx, elem) {
        nodes.push({
            id: mQuery(elem).attr('id').replace('CampaignEvent_', ''),
            positionX: parseInt(mQuery(elem).css('left'), 10),
            positionY: parseInt(mQuery(elem).css('top'), 10)
        });
    });
    mQuery("#CampaignCanvas .list-campaign-source").not('#CampaignEvent_newsource').not('#CampaignEvent_newsource_hide').each(function(idx, elem) {
        nodes.push({
            id: mQuery(elem).attr('id').replace('CampaignEvent_', ''),
            positionX: parseInt(mQuery(elem).css('left'), 10),
            positionY: parseInt(mQuery(elem).css('top'), 10)
        });
    });
    var connections = [];
    mQuery.each(Mautic.campaignBuilderInstance.getConnections(), function(idx, connection) {
        connections.push({
            sourceId: connection.sourceId.replace('CampaignEvent_', ''),
            targetId: connection.targetId.replace('CampaignEvent_', ''),
            anchors: mQuery.map(connection.endpoints, function(endpoint) {
                var anchor = Mautic.campaignBuilderGetEndpointDetails(endpoint);
                return {
                    'endpoint': anchor.anchorName,
                    'eventId': anchor.eventId
                };
            })
        });
    });
    var chart = {};
    chart.nodes = nodes;
    chart.connections = connections;
    var canvasSettings = {
        canvasSettings: chart
    };
    var campaignId = mQuery('#campaignId').val();
    var query = "action=campaign:updateConnections&campaignId=" + campaignId;
    mQuery.ajax({
        url: mauticAjaxUrl + '?' + query,
        type: "POST",
        data: canvasSettings,
        dataType: "json",
        success: function(response) {
            if (typeof callback === 'function') callback(false, response);
        },
        error: function(response, textStatus, errorThrown) {
            Mautic.processAjaxError(response, textStatus, errorThrown);
            if (typeof callback === 'function') callback(true, response);
        }
    });
};
Mautic.submitCampaignEvent = function(e) {
    e.preventDefault();
    mQuery('#campaignevent_canvasSettings_droppedX').val(mQuery('#droppedX').val());
    mQuery('#campaignevent_canvasSettings_droppedY').val(mQuery('#droppedY').val());
    mQuery('form[name="campaignevent"]').submit();
};
Mautic.submitCampaignSource = function(e) {
    e.preventDefault();
    mQuery('#campaign_leadsource_droppedX').val(mQuery('#droppedX').val());
    mQuery('#campaign_leadsource_droppedY').val(mQuery('#droppedY').val());
    mQuery('form[name="campaign_leadsource"]').submit();
};
Mautic.campaignBuilderReconnectEndpoints = function() {
    mQuery.each(Mautic.campaignConnectionCallbacks.beforeEndpointsReconnected, function(index, callback) {
        callback();
    });
    if (typeof Mautic.campaignBuilderCanvasSettings == 'undefined') {
        return;
    }
    if (typeof Mautic.campaignBuilderCanvasSettings.nodes !== 'undefined') {
        var sourceFound = false;
        mQuery.each(Mautic.campaignBuilderCanvasSettings.nodes, function(key, node) {
            if (typeof Mautic.campaignBuilderCanvasSources[node.id] !== 'undefined') {
                sourceFound = true;
            }
            mQuery('#CampaignEvent_' + node.id).css({
                position: 'absolute',
                left: node.positionX + 'px',
                top: node.positionY + 'px'
            });
            Mautic.campaignBuilderEventPositions['CampaignEvent_' + node.id] = {
                left: parseInt(node.positionX),
                top: parseInt(node.positionY)
            };
        });
    }
    if (typeof Mautic.campaignBuilderCanvasSettings.connections !== 'undefined') {
        mQuery.each(Mautic.campaignBuilderCanvasSettings.connections, function(key, connection) {
            if (typeof Mautic.campaignBuilderCanvasEvents[connection.targetId] !== 'undefined') {
                var targetEvent = Mautic.campaignBuilderCanvasEvents[connection.targetId];
            } else if (typeof Mautic.campaignBuilderCanvasSources[connection.targetId] !== 'undefined') {
                var targetEvent = Mautic.campaignBuilderCanvasSources[connection.targetId];
            }
            if (targetEvent && targetEvent.label) {
                Mautic.campaignBuilderLabels["CampaignEvent_" + connection.targetId] = targetEvent.label;
            }
            Mautic.campaignBuilderInstance.connect({
                uuids: ["CampaignEvent_" + connection.sourceId + '_' + connection.anchors.source, "CampaignEvent_" + connection.targetId + '_' + connection.anchors.target]
            });
        });
    }
    if (!sourceFound) {
        var topOffset = 25;
        mQuery.each(Mautic.campaignBuilderCanvasSources, function(type, source) {
            mQuery('#CampaignEvent_' + type).css({
                position: 'absolute',
                left: '20px',
                top: topOffset + 'px'
            });
        });
        topOffset += 45;
    }
    mQuery.each(Mautic.campaignConnectionCallbacks.afterEndpointsReconnected, function(index, callback) {
        callback();
    });
    delete Mautic.campaignBuilderCanvasSettings;
};
Mautic.campaignBuilderRegisterEndpoint = function(name, params) {
    var isTarget, isSource, color, connectorColor, connectorStyle;
    if (params.color) {
        color = params.color;
    } else {
        color = Mautic.campaignBuilderAnchorDefaultColor;
    }
    if (params.connectorColor) {
        connectorColor = params.connectorColor;
    } else {
        connectorColor = color;
    }
    if (params.connectorStyle) {
        connectorStyle = params.connectorStyle;
    } else {
        connectorStyle = ["Bezier", {
            curviness: 25
        }];
    }
    isTarget = params.isTarget;
    isSource = true;
    if (isTarget === null) {
        isTarget = true;
    } else {
        if (typeof isTarget == 'undefined') {
            isTarget = false;
        }
        if (isTarget) {
            isSource = false;
        }
    }
    Mautic.campaignEndpoints[name] = {
        endpoint: ["Dot", {
            radius: 10
        }],
        paintStyle: {
            fill: color
        },
        endpointStyle: {
            fill: color
        },
        connectorStyle: {
            stroke: connectorColor,
            strokeWidth: 1
        },
        connector: connectorStyle,
        connectorOverlays: [
            ["Arrow", {
                width: 8,
                length: 8,
                location: 0.5
            }]
        ],
        maxConnections: -1,
        isTarget: isTarget,
        isSource: isSource,
        beforeDrop: Mautic.campaignBeforeDropCallback,
        beforeDetach: Mautic.campaignBeforeDetachCallback,
        beforeStartDetach: Mautic.campaignBeforeStartDetachCallback,
        beforeDrag: Mautic.campaignBeforeDragCallback
    }
};
Mautic.campaignBuilderRegisterAnchors = function(names, el) {
    var id = mQuery(el).attr('id');
    mQuery(names).each(function(key, anchorName) {
        var theAnchor = Mautic.campaignEndpointDefinitions[anchorName]['anchors'];
        theAnchor[6] = anchorName.toLowerCase() + ' ' + id;
        var ep = Mautic.campaignBuilderInstance.addEndpoint(id, {
            anchor: theAnchor,
            uuid: id + "_" + anchorName.toLowerCase()
        }, Mautic.campaignEndpoints[anchorName]);
        ep.bind("mouseover", function(endpoint, event) {
            var epDetails = Mautic.campaignBuilderGetEndpointDetails(endpoint);
            if (!Mautic.campaignHoverCallback(epDetails, endpoint, event)) {
                return;
            }
            if (epDetails.anchorName == 'top') {
                return;
            }
            if (epDetails.anchorName == 'leadsourceleft' || epDetails.anchorName == 'leadsourceright') {
                if (mQuery('#SourceList option:enabled').length === 1) {
                    return;
                }
            }
            endpoint.setPaintStyle({
                fill: endpoint.connectorStyle.stroke
            });
            var dot = mQuery(endpoint.canvas);
            dot.addClass('jtk-clickable_anchor');
            if (!dot.find('svg text').length) {
                var svg = dot.find('svg')[0];
                var textElement = document.createElementNS("http://www.w3.org/2000/svg", 'text');
                textElement.setAttributeNS(null, 'x', '50%');
                textElement.setAttributeNS(null, 'y', '50%');
                textElement.setAttributeNS(null, 'text-anchor', 'middle');
                textElement.setAttributeNS(null, 'stroke-width', '2px');
                textElement.setAttributeNS(null, 'stroke', '#ffffff');
                textElement.setAttributeNS(null, 'dy', '.3em');
                var textNode = document.createTextNode('+');
                textElement.appendChild(textNode);
                svg.appendChild(textElement);
            }
        });
        ep.bind("mouseout", function(endpoint) {
            var dot = mQuery(endpoint.canvas);
            dot.removeClass('jtk-clickable_anchor');
            if (!endpoint.connections.length) {
                endpoint.setPaintStyle({
                    fill: Mautic.campaignBuilderAnchorDefaultColor
                });
            }
        });
        ep.bind("click", function(endpoint, event) {
            if (mQuery('#CampaignEvent_newsource').length) {
                return;
            }
            var epDetails = Mautic.campaignBuilderGetEndpointDetails(endpoint);
            if (epDetails.anchorName == 'top') {
                return;
            }
            if (epDetails.anchorName == 'leadsourceleft' || epDetails.anchorName == 'leadsourceright') {
                if (mQuery('#SourceList option:enabled').length === 1) {
                    return;
                }
            }
            var epDetails = Mautic.campaignBuilderGetEndpointDetails(endpoint);
            var clickedAnchorName = epDetails.anchorName;
            Mautic.campaignBuilderAnchorClicked = endpoint.elementId + '_' + clickedAnchorName;
            Mautic.campaignBuilderAnchorNameClicked = clickedAnchorName;
            Mautic.campaignBuilderAnchorEventTypeClicked = epDetails.eventType;
            var elPos = Mautic.campaignBuilderGetEventPosition(endpoint.element);
            var spotFound = false,
                putLeft = elPos.left,
                putTop = elPos.top,
                direction = '',
                fullWidth = Mautic.campaignBuilderEventDimensions.width + Mautic.campaignBuilderEventDimensions.anchor,
                wiggleWidth = fullWidth + Mautic.campaignBuilderEventDimensions.wiggleWidth,
                fullHeight = Mautic.campaignBuilderEventDimensions.height + Mautic.campaignBuilderEventDimensions.anchor,
                wiggleHeight = fullHeight + Mautic.campaignBuilderEventDimensions.wiggleHeight,
                debug = false;
            if (debug) {
                console.log(Mautic.campaignBuilderEventPositions);
                console.log(clickedAnchorName + ' - starting with: x = ' + putLeft + ', y = ' + putTop);
            }
            switch (clickedAnchorName) {
                case 'leadsourceleft':
                    direction = 'xl';
                    putLeft -= wiggleWidth;
                    break;
                case 'leadsourceright':
                    direction = 'xr';
                    putLeft += wiggleWidth;
                    break;
                case 'bottom':
                    direction = 'yd';
                    putTop += wiggleHeight;
                    break;
                case 'yes':
                case 'leadsource':
                    putLeft -= Mautic.campaignBuilderEventDimensions.width / 2;
                    putTop += wiggleHeight;
                    direction = 'xl';
                    break;
                case 'no':
                    putLeft += Mautic.campaignBuilderEventDimensions.width / 2;
                    putTop += wiggleHeight;
                    direction = 'xr';
                    break;
                case 'top':
                    directon = 'yu';
                    putTop -= wiggleHeight;
                    break;
            }
            if (debug) {
                console.log('Going direction: ' + direction);
                console.log('Start test with: x = ' + putLeft + ', y = ' + putTop);
            }
            var counter = 0;
            var windowWidth = mQuery(window).width();
            while (!spotFound) {
                var isOccupied = false;
                mQuery.each(Mautic.campaignBuilderEventPositions, function(id, pos) {
                    var l = Math.max(putLeft, pos.left);
                    var r = Math.min(putLeft + fullWidth, pos.left + fullWidth);
                    var b = Math.max(putTop, pos.top);
                    var t = Math.min(putTop + fullHeight, pos.top + fullHeight);
                    var h = t - b;
                    var w = r - l;
                    if (debug) {
                        console.log('Checking ' + id);
                        console.log(putLeft, putTop, l, r, b, t, h, w);
                    }
                    if (h > 0 && w > 0) {
                        if (debug) {
                            console.log('Slot occupied by ' + id);
                        }
                        isOccupied = true;
                        switch (direction) {
                            case 'xl':
                                putLeft -= (w + Mautic.campaignBuilderEventDimensions.wiggleWidth);
                                if (putLeft <= 0) {
                                    putLeft = 0;
                                    direction = 'yd';
                                    putTop += fullHeight + Mautic.campaignBuilderEventDimensions.wiggleHeight;
                                }
                                break;
                            case 'xr':
                                if (putLeft + w + Mautic.campaignBuilderEventDimensions.wiggleWidth > windowWidth) {
                                    direction = 'yd';
                                    putLeft -= Mautic.campaignBuilderEventDimensions.wiggleWidth;
                                    putTop += fullHeight + Mautic.campaignBuilderEventDimensions.wiggleHeight;
                                } else {
                                    putLeft += (w + Mautic.campaignBuilderEventDimensions.wiggleWidth);
                                }
                                break;
                            case 'yu':
                                putTop -= (h - Mautic.campaignBuilderEventDimensions.wiggleHeight);
                                if (putTop <= 0) {
                                    putTop = 0;
                                    direction = 'xr';
                                }
                                break;
                            case 'yd':
                                putTop += (h + Mautic.campaignBuilderEventDimensions.wiggleHeight);
                                break;
                        }
                        return false
                    }
                });
                if (!isOccupied) {
                    if (debug) {
                        console.log('It fits!');
                    }
                    spotFound = true;
                }
                counter++;
                if (counter >= 100) {
                    putTop = 10;
                    putLeft = 10;
                    if (debug) {
                        console.log('Too many loops');
                    }
                    spotFound = true;
                }
            }
            if (debug) {
                console.log('To be placed at: x = ' + putLeft + ', y = ' + putTop);
            }
            if (putLeft <= 0) {
                putLeft = 10;
            }
            if (putTop <= 0) {
                putTop = 10;
            }
            mQuery('#droppedX').val(putLeft);
            mQuery('#droppedY').val(putTop);
            var allowedEvents = [];
            mQuery.each(Mautic.campaignBuilderConnectionsMap[epDetails.eventType][epDetails.anchorName], function(group, eventTypes) {
                if (eventTypes.length) {
                    allowedEvents[allowedEvents.length] = group.charAt(0).toUpperCase() + group.substr(1);
                }
            });
            Mautic.campaignBuilderAnchorClickedAllowedEvents = allowedEvents;
            if (!(mQuery('.preview').length)) {
                var el = (mQuery(event.target).hasClass('jtk-endpoint')) ? event.target : mQuery(event.target).parents('.jtk-endpoint')[0];
                Mautic.campaignBuilderAnchorClickedPosition = Mautic.campaignBuilderGetEventPosition(el);
                Mautic.campaignBuilderUpdateEventList(allowedEvents, false, 'groups');
            }
            mQuery('.campaign-event-selector:not(#SourceList) option').prop('disabled', false);
            if ('source' == epDetails.eventType) {
                var checkSelects = ['action', 'decision', 'condition'];
            } else {
                var primaryType = (epDetails.eventType === 'decision') ? 'action' : 'decision';
                var checkSelects = [primaryType, 'condition'];
            }
            mQuery.each(checkSelects, function(key, targetType) {
                var selectId = '#' + targetType.charAt(0).toUpperCase() + targetType.slice(1) + 'List';
                mQuery(selectId + ' option').each(function() {
                    var optionVal = mQuery(this).val();
                    if (optionVal) {
                        if (!Mautic.campaignBuilderValidateConnection(epDetails, targetType, optionVal)) {
                            mQuery(this).prop('disabled', true);
                        }
                    }
                });
                mQuery(selectId).trigger('chosen:updated');
            });
        });
    });
};
Mautic.campaignBuilderGetEventPosition = function(el) {
    return {
        'left': parseInt(mQuery(el).css('left')),
        'top': parseInt(mQuery(el).css('top'))
    }
};
Mautic.campaignBuilderUpdateEventList = function(groups, hidden, view, active, forcePosition) {
    var groupsEnabled = 0;
    var inGroupsView = ('groups' == view);
    if (groups.length === 1 && mQuery.inArray('Source', groups) !== -1 && !hidden) {
        inGroupsView = false;
    }
    mQuery.each(['Source', 'Action', 'Decision', 'Condition'], function(key, theGroup) {
        if (mQuery.inArray(theGroup, groups) !== -1) {
            if (inGroupsView) {
                mQuery('#' + theGroup + 'GroupSelector').removeClass('hide');
                if ('source' != theGroup) {
                    groupsEnabled++;
                }
            } else {
                mQuery('#' + theGroup + 'GroupList').removeClass('hide');
            }
        } else {
            if (inGroupsView) {
                mQuery('#' + theGroup + 'GroupSelector').addClass('hide');
            } else {
                mQuery('#' + theGroup + 'GroupList').addClass('hide');
            }
        }
    });
    if (inGroupsView) {
        mQuery.each(groups, function(key, theGroup) {
            mQuery('#' + theGroup + 'GroupSelector').removeClass(function(index, css) {
                return (css.match(/col-(\S+)/g) || []).join(' ');
            }).addClass('col-md-' + (12 / groupsEnabled));
        });
        var newWidth = (500 / 3) * groupsEnabled;
        if (newWidth >= mQuery(window).width()) {
            newWidth = mQuery(window).width() - 10;
        }
        var leftPos = (forcePosition) ? forcePosition.left : Mautic.campaignBuilderAnchorClickedPosition.left - (newWidth / 2 - 10);
        var topPos = (forcePosition) ? forcePosition.top : Mautic.campaignBuilderAnchorClickedPosition.top + 25;
        mQuery('#CampaignEventPanel').css({
            left: (leftPos >= 0) ? leftPos : 10,
            top: topPos,
            width: newWidth,
            height: 280
        });
        mQuery('#CampaignEventPanel').removeClass('hide');
        mQuery('#CampaignEventPanelGroups').removeClass('hide');
        mQuery('#CampaignEventPanelLists').addClass('hide');
    } else {
        var leftPos = (forcePosition) ? forcePosition.left : Mautic.campaignBuilderAnchorClickedPosition.left - 125;
        var topPos = (forcePosition) ? forcePosition.top : Mautic.campaignBuilderAnchorClickedPosition.top + 25;
        mQuery('#CampaignEventPanel').css({
            left: (leftPos >= 0) ? leftPos : 10,
            top: topPos,
            width: 300,
            height: 80,
        });
        mQuery('#CampaignEventPanelGroups').addClass('hide');
        mQuery('#CampaignEventPanelLists').removeClass('hide');
        mQuery('#CampaignEventPanel').removeClass('hide');
        if (groups.length === 1) {
            setTimeout(function() {
                mQuery('#CampaignEventPanelLists #' + groups[0] + 'List').trigger('chosen:open');
            }, 10);
        }
    }
};
Mautic.campaignBuilderGetEndpointDetails = function(endpoint) {
    var anchorName, eventId;
    if (typeof endpoint === 'string') {
        eventId = endpoint;
    } else {
        var parts = endpoint.anchor.cssClass.split(' ');
        if (parts.length > 1) {
            anchorName = parts[0];
            eventId = parts[1];
        } else {
            anchorName = parts[0];
            eventId = endpoint.elementId
        }
    }
    return {
        'anchorName': anchorName,
        'eventId': eventId.replace('CampaignEvent_', ''),
        'elementId': eventId,
        'eventType': mQuery('#' + eventId).data('type'),
        'event': mQuery('#' + eventId).data('event')
    };
};
Mautic.campaignBuilderPrepareNewSource = function() {
    var newSourcePos = {
        left: mQuery(window).width() / 2 - 100,
        top: 50
    };
    mQuery('#CampaignEvent_newsource').css(newSourcePos);
    Mautic.campaignBuilderUpdateEventList(['Source'], false, 'list', false, {
        left: newSourcePos.left - 50,
        top: newSourcePos.top + 35
    });
    mQuery('#SourceList').trigger('chosen:open');
};
Mautic.campaignBuilderValidateConnection = function(epDetails, targetType, targetEvent) {
    var valid = true;
    var sourceType = epDetails.eventType;
    var sourceEvent = 'source' === sourceType ? sourceType : epDetails.event;
    if (typeof Mautic.campaignBuilderConnectionRestrictions[targetEvent] !== 'undefined') {
        if ('source' === sourceEvent) {
            mQuery.each(Mautic.campaignBuilderConnectionRestrictions[targetEvent]['source'], function(eventType, events) {
                if (events.length) {
                    valid = false;
                    return false;
                }
            });
            return valid;
        }
        if (typeof Mautic.campaignBuilderConnectionRestrictions[targetEvent]['source'][sourceType] !== 'undefined' && Mautic.campaignBuilderConnectionRestrictions[targetEvent]['source'][sourceType].length && mQuery.inArray(sourceEvent, Mautic.campaignBuilderConnectionRestrictions[targetEvent]['source'][sourceType]) === -1) {
            valid = false;
        }
    }
    if (typeof Mautic.campaignBuilderConnectionRestrictions[sourceEvent] !== 'undefined' && typeof Mautic.campaignBuilderConnectionRestrictions[sourceEvent]['target'][targetType] !== 'undefined' && Mautic.campaignBuilderConnectionRestrictions[sourceEvent]['target'][targetType].length) {
        valid = (mQuery.inArray(targetEvent, Mautic.campaignBuilderConnectionRestrictions[sourceEvent]['target'][targetType]) !== -1);
    }
    if (typeof Mautic.campaignBuilderConnectionRestrictions['anchor'][sourceType] !== 'undefined' && typeof Mautic.campaignBuilderConnectionRestrictions['anchor'][sourceType][targetEvent] !== 'undefined') {
        mQuery(Mautic.campaignBuilderConnectionRestrictions['anchor'][sourceType][targetEvent]).each(function(key, anchor) {
            switch (anchor) {
                case 'inaction':
                    anchor = 'no';
                    break;
                case 'action':
                    anchor = 'yes';
                    break;
            }
            if (anchor == epDetails.anchorName) {
                valid = false;
                return false;
            }
        });
    }
    return valid;
};
Mautic.updateScheduledCampaignEvent = function(eventId, contactId) {
    mQuery('#timeline-campaign-event-' + eventId + ' .btn-reschedule').addClass('disabled');
    var converting = false;
    var eventWrapper = '#timeline-campaign-event-' + eventId;
    var eventSpan = '.timeline-campaign-event-date-' + eventId;
    var eventText = '#timeline-campaign-event-text-' + eventId;
    var saveButton = '#timeline-campaign-event-save-' + eventId;
    var originalDate = mQuery(eventWrapper + ' ' + eventSpan).first().text();
    var revertInput = function(input) {
        converting = true;
        mQuery(input).datetimepicker('destroy');
        mQuery(eventSpan).text(originalDate);
        mQuery(eventWrapper + ' .btn-reschedule').removeClass('disabled');
    };
    var date = mQuery(eventSpan).attr('data-date');
    mQuery(saveButton).show();
    var input = mQuery('<input type="text" id="timeline-reschedule"/>').css('height', '20px').css('color', '#000000').val(date).on('keyup', function(e) {
        var code = e.keyCode || e.which;
        if (code == 13) {
            e.preventDefault();
            converting = true
            mQuery(input).prop('readonly', true);
            mQuery(input).datetimepicker('destroy');
            Mautic.ajaxActionRequest('campaign:updateScheduledCampaignEvent', {
                eventId: eventId,
                contactId: contactId,
                date: mQuery(this).val(),
                originalDate: date
            }, function(response) {
                mQuery(eventSpan).text(response.formattedDate);
                mQuery(eventSpan).attr('data-date', response.date);
                mQuery(eventWrapper + ' .btn-reschedule').removeClass('disabled');
                if (response.success) {
                    mQuery(eventText).removeClass('text-warning').addClass('text-info');
                    mQuery(eventSpan).css('textDecoration', 'inherit');
                    mQuery('.fa.timeline-campaign-event-cancelled-' + eventId).remove();
                    mQuery('.timeline-campaign-event-scheduled-' + eventId).removeClass('hide');
                    mQuery('.timeline-campaign-event-cancelled-' + eventId).addClass('hide');
                    mQuery(saveButton).hide();
                }
            }, false);
        } else if (code == 27) {
            e.preventDefault();
            revertInput(input);
            mQuery(saveButton).hide();
        }
    }).on('blur', function(e) {
        if (!converting) {
            revertInput(input);
        }
        mQuery(saveButton).hide();
    });
    mQuery('#timeline-campaign-event-' + eventId + ' ' + eventSpan).html(input);
    Mautic.activateDateTimeInputs('#timeline-reschedule');
    mQuery('#timeline-reschedule').focus();
};
Mautic.saveScheduledCampaignEvent = function(eventId, contactId) {
    var saveButton = '#timeline-campaign-event-save-' + eventId;
    mQuery(saveButton).addClass('disabled');
    var eventWrapper = '#timeline-campaign-event-' + eventId;
    var eventSpan = '.timeline-campaign-event-date-' + eventId;
    var eventText = '#timeline-campaign-event-text-' + eventId;
    var date = mQuery(eventSpan).attr('data-date');
    Mautic.ajaxActionRequest('campaign:updateScheduledCampaignEvent', {
        eventId: eventId,
        contactId: contactId,
        date: mQuery('#timeline-reschedule').val(),
        originalDate: date
    }, function(response) {
        mQuery(eventSpan).text(response.formattedDate);
        mQuery(eventSpan).attr('data-date', response.date);
        if (response.success) {
            mQuery(eventText).removeClass('text-warning').addClass('text-info');
            mQuery(eventSpan).css('textDecoration', 'inherit');
            mQuery('.fa.timeline-campaign-event-cancelled-' + eventId).remove();
            mQuery('.timeline-campaign-event-scheduled-' + eventId).removeClass('hide');
            mQuery('.timeline-campaign-event-cancelled-' + eventId).addClass('hide');
        }
        mQuery(saveButton).removeClass('disabled').hide();
        mQuery(eventWrapper + ' .btn-reschedule').removeClass('disabled');
    }, false);
};
Mautic.cancelScheduledCampaignEvent = function(eventId, contactId) {
    mQuery('#timeline-campaign-event-' + eventId + ' .btn').prop('disabled', true).addClass('disabled');
    var eventWrapper = '#timeline-campaign-event-' + eventId;
    var eventSpan = '.timeline-campaign-event-date-' + eventId;
    var eventText = '#timeline-campaign-event-text-' + eventId;
    Mautic.ajaxActionRequest('campaign:cancelScheduledCampaignEvent', {
        eventId: eventId,
        contactId: contactId,
    }, function(response) {
        if (response.success) {
            mQuery(eventText).removeClass('text-info').addClass('text-warning');
            mQuery(eventWrapper + ' .btn-edit').prop('disabled', false).removeClass('disabled');
            mQuery('.timeline-campaign-event-scheduled-' + eventId).addClass('hide');
            mQuery('.timeline-campaign-event-cancelled-' + eventId).removeClass('hide');
        } else {
            mQuery(eventWrapper + ' .btn').prop('disabled', false).removeClass('disabled');
        }
    }, false);
};
Mautic.updateJumpToEventOptions = function() {
    var jumpToEventSelectNode = mQuery("#campaignevent_properties_jumpToEvent");
    jumpToEventSelectNode.children().remove();
    for (var eventId in Mautic.campaignBuilderCanvasEvents) {
        var event = Mautic.campaignBuilderCanvasEvents[eventId];
        if (event.type !== 'campaign.jump_to_event' && event.eventType !== 'decision') {
            var opt = mQuery("<option />").attr("value", event.id).text(event.name)
            if (event.id == jumpToEventSelectNode.data("selected")) {
                opt.attr("selected", "selected");
            }
            jumpToEventSelectNode.append(opt);
        }
    }
    jumpToEventSelectNode.trigger("chosen:updated");
};
Mautic.highlightJumpTarget = function(event, el) {
    var element = mQuery(el);
    var parentEventElement = element.parent().parent();
    var highlightedAlready = parentEventElement.data('highlighted');
    var jumpTargetID = '#CampaignEvent_' + element.data('jumpTarget');
    var jumpTarget = mQuery(jumpTargetID);
    var overlay = mQuery('#EventJumpOverlay');
    if (highlightedAlready) {
        parentEventElement.data('highlighted', false);
        overlay.hide();
        parentEventElement.css("z-index", 1010);
        jumpTarget.css("z-index", 1010);
    } else {
        parentEventElement.data('highlighted', true);
        overlay.show();
        parentEventElement.css("z-index", 2010);
        jumpTarget.css("z-index", 2010);
    }
};;
Mautic.categoryOnLoad = function(container, response) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'category');
    }
    if (response && response.inForm) {
        var newOption = mQuery('<option />').val(response.categoryId);
        newOption.html(response.categoryName);
        mQuery(".category-select option:last").prev().before(newOption);
        newOption.prop('selected', true);
        mQuery('.category-select').val(response.categoryId).trigger("chosen:updated");
    }
};;
Mautic.messagesOnLoad = function(container) {
    mQuery(container + ' .sortable-panel-wrapper .modal').each(function() {
        mQuery(this).closest('.panel').append(mQuery(this));
    });
};
Mautic.toggleChannelFormDisplay = function(el, channel) {
    Mautic.toggleTabPublished(el);
    if (mQuery(el).val() === "1" && mQuery(el).prop('checked')) {
        mQuery(el).closest('.tab-pane').find('.message_channel_properties_' + channel).removeClass('hide')
    } else {
        mQuery(el).closest('.tab-pane').find('.message_channel_properties_' + channel).addClass('hide');
    }
};
Mautic.cancelQueuedMessageEvent = function(channelId) {
    Mautic.ajaxActionRequest('channel:cancelQueuedMessageEvent', {
        channelId: channelId
    }, function(response) {
        if (response.success) {
            mQuery('#queued-message-' + channelId).addClass('disabled');
            mQuery('#queued-status-' + channelId).html(Mautic.translate('mautic.message.queue.status.cancelled'));
        }
    }, false);
};;
Mautic.removeConfigValue = function(action, el) {
    Mautic.executeAction(action, function(response) {
        if (response.success) {
            mQuery(el).parent().addClass('hide');
        }
    });
};
Mautic.parseQuery = function(query) {
    var vars = query.split('&');
    var queryString = {};
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        var key = decodeURIComponent(pair[0]);
        var value = decodeURIComponent(pair[1]);
        if (typeof queryString[key] === 'undefined') {
            queryString[key] = decodeURIComponent(value);
        } else if (typeof queryString[key] === 'string') {
            var arr = [queryString[key], decodeURIComponent(value)];
            queryString[key] = arr;
        } else {
            queryString[key].push(decodeURIComponent(value));
        }
    }
    return queryString;
}
Mautic.parseUrlHashParameter = function(url) {
    var url = url.split('#');
    if ('undefined' != typeof url[1]) {
        return url[1];
    }
    return false;
}
Mautic.observeConfigTabs = function() {
    if (!mQuery('#config_coreconfig_last_shown_tab').length) {
        return;
    }
    var parameters = Mautic.parseQuery(window.location.search.substr(1));
    if ('undefiend' != typeof parameters['tab']) {
        mQuery('#config_coreconfig_last_shown_tab').val(parameters['tab']);
        mQuery('a[data-toggle="tab"]').each(function(i, tab) {
            if (mQuery(tab).attr('href') == ('#' + parameters['tab'])) {
                mQuery(tab).tab('show');
            }
        });
    }
    mQuery('a[data-toggle="tab"]').on('show.bs.tab', function(e) {
        var tab = Mautic.parseUrlHashParameter(e.target.href);
        if (tab) {
            mQuery('#config_coreconfig_last_shown_tab').val(tab);
        }
    });
}
mQuery(Mautic.observeConfigTabs);;
Mautic.widgetUrl = mauticBasePath + (mauticEnv === 'dev' ? '/index_dev.php' : '') + '/s/dashboard/widget/';
Mautic.dashboardSubmitButton = false;
Mautic.dashboardOnLoad = function(container) {
    Mautic.loadWidgets();
};
Mautic.loadWidgets = function() {
    Mautic.dashboardFilterPreventSubmit();
    jQuery('.widget').each(function() {
        let widgetId = jQuery(this).attr('data-widget-id');
        let container = jQuery('.widget[data-widget-id="' + widgetId + '"]');
        jQuery.ajax({
            url: Mautic.widgetUrl + widgetId + '?ignoreAjax=true',
        }).done(function(response) {
            Mautic.widgetOnLoad(container, response);
        });
    });
    jQuery(document).ajaxComplete(function() {
        Mautic.initDashboardFilter();
    });
};
Mautic.initDashboardFilter = function() {
    let form = jQuery('form[name="daterange"]');
    form.find('button').replaceWith(Mautic.dashboardSubmitButton);
    form.unbind('submit').on('submit', function(e) {
        e.preventDefault();
        Mautic.dashboardFilterPreventSubmit();
        jQuery('.widget').each(function() {
            let widgetId = jQuery(this).attr('data-widget-id');
            let element = jQuery('.widget[data-widget-id="' + widgetId + '"]');
            jQuery.ajax({
                type: 'POST',
                url: Mautic.widgetUrl + widgetId + '?ignoreAjax=true',
                data: form.serializeArray(),
                success: function(response) {
                    Mautic.widgetOnLoad(element, response);
                }
            });
        });
    });
};
Mautic.dashboardFilterPreventSubmit = function() {
    let form = jQuery('form[name="daterange"]');
    let button = form.find('button:first');
    Mautic.dashboardSubmitButton = button.clone();
    button.width(button.width() + 'px');
    button.html('<i class="fa fa-spin fa-spinner"></i>');
    jQuery('.widget').html('<div class="spinner"><i class="fa fa-spin fa-spinner"></i></div>');
    form.unbind('submit').on('submit', function(e) {
        e.preventDefault();
    });
};
Mautic.dashboardOnUnload = function(id) {
    mQuery('.jvectormap-tip').remove();
};
Mautic.widgetOnLoad = function(container, response) {
    if (!response.widgetId) return;
    var widget = mQuery('[data-widget-id=' + response.widgetId + ']');
    var widgetHtml = mQuery(response.widgetHtml);
    widgetHtml.find("*[data-toggle='ajaxmodal']").on('click.ajaxmodal', function(event) {
        event.preventDefault();
        Mautic.ajaxifyModal(this, event);
    });
    if (!widget.length) {
        widget = mQuery('<div/>').addClass('widget').attr('data-widget-id', response.widgetId);
        mQuery('#dashboard-widgets').prepend(widget);
    }
    widget.html(widgetHtml).css('width', response.widgetWidth + '%').css('height', response.widgetHeight + '%');
    Mautic.renderCharts(widgetHtml);
    Mautic.renderMaps(widgetHtml);
    Mautic.initWidgetRemoveEvents();
    Mautic.initWidgetSorting();
    Mautic.initDashboardFilter();
};
Mautic.initWidgetRemoveEvents = function() {
    jQuery('.remove-widget').unbind('click').on('click', function(e) {
        e.preventDefault();
        element = jQuery(this);
        let url = element.attr('href');
        element.closest('.widget').remove();
        jQuery.ajax({
            url: url,
        });
    });
};
Mautic.initWidgetSorting = function() {
    var widgetsWrapper = mQuery('#dashboard-widgets');
    var bodyOverflow = {};
    widgetsWrapper.sortable({
        handle: '.card-header h4',
        placeholder: 'sortable-placeholder',
        items: '.widget',
        opacity: 0.9,
        scroll: true,
        scrollSpeed: 10,
        tolerance: "pointer",
        cursor: 'move',
        appendTo: '#dashboard-widgets',
        helper: function(e, ui) {
            ui.children().each(function() {
                mQuery(this).width(mQuery(this).width());
                mQuery(this).height(mQuery(this).height());
            });
            bodyOverflow.overflowX = mQuery('body').css('overflow-x');
            bodyOverflow.overflowY = mQuery('body').css('overflow-y');
            mQuery('body').css({
                overflowX: 'visible',
                overflowY: 'visible'
            });
            mQuery("#dashboard-widgets .widget").each(function(i) {
                var item = mQuery(this);
                var item_clone = item.clone();
                var canvas = item.find('canvas').first();
                if (canvas.length) {
                    var destCanvas = item_clone.find('canvas').first();
                    var destCtx = destCanvas[0].getContext('2d');
                    destCtx.drawImage(canvas[0], 0, 0);
                }
                item.data("clone", item_clone);
                var position = item.position();
                item_clone.css({
                    left: position.left,
                    top: position.top,
                    width: item.width(),
                    visibility: "visible",
                    position: "absolute",
                    zIndex: 1
                });
                item.css('visibility', 'hidden');
                mQuery("#cloned-widgets").append(item_clone);
            });
            return ui;
        },
        start: function(e, ui) {
            ui.helper.css('visibility', 'visible');
            ui.helper.data("clone").hide();
        },
        sort: function(e, ui) {
            var card = ui.item.find('.card').first();
            ui.placeholder.width(card.width());
            ui.placeholder.height(card.height());
            ui.placeholder.css({
                marginTop: "5px",
                marginBottom: "5px",
                marginLeft: 0,
                marginRight: 0
            });
        },
        stop: function() {
            mQuery('body').css(bodyOverflow);
            mQuery("#dashboard-widgets .widget.exclude-me").each(function() {
                var item = mQuery(this);
                var clone = item.data("clone");
                var position = item.position();
                clone.css("left", position.left);
                clone.css("top", position.top);
                clone.show();
                item.removeClass("exclude-me");
            });
            mQuery("#dashboard-widgets .widget").css("visibility", "visible");
            mQuery("#cloned-widgets .widget").remove();
            Mautic.saveWidgetSorting();
        },
        change: function(e, ui) {
            mQuery("#dashboard-widgets .widget:not(.exclude-me)").each(function() {
                var item = mQuery(this);
                var clone = item.data("clone");
                clone.stop(true, false);
                var position = item.position();
                clone.animate({
                    left: position.left,
                    top: position.top
                }, 200);
            });
        }
    }).disableSelection();
}
Mautic.saveWidgetSorting = function() {
    var widgetsWrapper = mQuery('#dashboard-widgets');
    var widgets = widgetsWrapper.children();
    var ordering = [];
    widgets.each(function(index, value) {
        ordering.push(mQuery(this).attr('data-widget-id'));
    });
    Mautic.ajaxActionRequest('dashboard:updateWidgetOrdering', {
        'ordering': ordering
    }, function(response) {});
}
Mautic.updateWidgetForm = function(element) {
    Mautic.activateLabelLoadingIndicator('widget_type');
    var formWrapper = mQuery(element).closest('form');
    var WidgetFormValues = formWrapper.serializeArray();
    Mautic.ajaxActionRequest('dashboard:updateWidgetForm', WidgetFormValues, function(response) {
        if (response.formHtml) {
            var formHtml = mQuery(response.formHtml);
            formHtml.find('#widget_buttons').addClass('hide hidden');
            formWrapper.html(formHtml.children());
            Mautic.onPageLoad('#widget_params');
        }
        Mautic.removeLabelLoadingIndicator();
    });
};
Mautic.exportDashboardLayout = function(text, baseUrl) {
    var name = prompt(text, "");
    if (name !== null) {
        if (name) {
            baseUrl = baseUrl + "?name=" + encodeURIComponent(name);
        }
        window.location = baseUrl;
    }
};
Mautic.saveDashboardLayout = function(text) {
    var name = prompt(text, "");
    if (name) {
        mQuery.ajax({
            type: 'POST',
            url: mauticBaseUrl + 's/dashboard/save',
            data: {
                name: name
            }
        });
    }
};;
Mautic.toggleDwcFilters = function() {
    mQuery("#dwcFiltersTab, #slotNameDiv").toggleClass("hide");
    if (mQuery("#dwcFiltersTab").hasClass('hide')) {
        mQuery('.nav-tabs a[href="#details"]').click();
    } else {
        Mautic.dynamicContentOnLoad();
    }
};
Mautic.dynamicContentOnLoad = function(container, response) {
    if (typeof container !== 'object') {
        if (mQuery(container + ' #list-search').length) {
            Mautic.activateSearchAutocomplete('list-search', 'dynamicContent');
        }
    }
    var availableFilters = mQuery('div.dwc-filter').find('select[data-mautic="available_filters"]');
    Mautic.activateChosenSelect(availableFilters, false);
    Mautic.leadlistOnLoad('div.dwc-filter');
};
Mautic.standardDynamicContentUrl = function(options) {
    if (!options) {
        return;
    }
    var url = options.windowUrl;
    if (url) {
        var editDynamicContentKey = '/dwc/edit/dynamicContentId';
        var previewDynamicContentKey = '/dwc/preview/dynamicContentId';
        if (url.indexOf(editDynamicContentKey) > -1 || url.indexOf(previewDynamicContentKey) > -1) {
            options.windowUrl = url.replace('dynamicContentId', mQuery('#campaignevent_properties_dynamicContent').val());
        }
    }
    return options;
};
Mautic.disabledDynamicContentAction = function(opener) {
    if (typeof opener == 'undefined') {
        opener = window;
    }
    var dynamicContent = opener.mQuery('#campaignevent_properties_dynamicContent').val();
    var disabled = dynamicContent === '' || dynamicContent === null;
    opener.mQuery('#campaignevent_properties_editDynamicContentButton').prop('disabled', disabled);
};
if (typeof MauticIsDwcReady === 'undefined') {
    var MauticIsDwcReady = true;
    if (document.readyState === "complete" || !(document.readyState === "loading" || document.documentElement.doScroll)) {
        Mautic.dynamicContentOnLoad();
    } else {
        document.addEventListener("DOMContentLoaded", Mautic.dynamicContentOnLoad);
    }
};
Mautic.testMonitoredEmailServerConnection = function(mailbox) {
    var data = {
        host: mQuery('#config_emailconfig_monitored_email_' + mailbox + '_host').val(),
        port: mQuery('#config_emailconfig_monitored_email_' + mailbox + '_port').val(),
        encryption: mQuery('#config_emailconfig_monitored_email_' + mailbox + '_encryption').val(),
        user: mQuery('#config_emailconfig_monitored_email_' + mailbox + '_user').val(),
        password: mQuery('#config_emailconfig_monitored_email_' + mailbox + '_password').val(),
        mailbox: mailbox
    };
    var abortCall = false;
    if (!data.host) {
        mQuery('#config_emailconfig_monitored_email_' + mailbox + '_host').parent().addClass('has-error');
        abortCall = true;
    } else {
        mQuery('#config_emailconfig_monitored_email_' + mailbox + '_host').parent().removeClass('has-error');
    }
    if (!data.port) {
        mQuery('#config_emailconfig_monitored_email_' + mailbox + '_port').parent().addClass('has-error');
        abortCall = true;
    } else {
        mQuery('#config_emailconfig_monitored_email_' + mailbox + '_port').parent().removeClass('has-error');
    }
    if (abortCall) {
        return;
    }
    mQuery('#' + mailbox + 'TestButtonContainer .fa-spinner').removeClass('hide');
    Mautic.ajaxActionRequest('email:testMonitoredEmailServerConnection', data, function(response) {
        var theClass = (response.success) ? 'has-success' : 'has-error';
        var theMessage = response.message;
        mQuery('#' + mailbox + 'TestButtonContainer').removeClass('has-success has-error').addClass(theClass);
        mQuery('#' + mailbox + 'TestButtonContainer .help-block').html(theMessage);
        mQuery('#' + mailbox + 'TestButtonContainer .fa-spinner').addClass('hide');
        if (response.folders) {
            if (mailbox == 'general') {
                mQuery('select[data-imap-folders]').each(function(index) {
                    var thisMailbox = mQuery(this).data('imap-folders');
                    if (mQuery('#config_emailconfig_monitored_email_' + thisMailbox + '_override_settings_0').is(':checked')) {
                        var folder = '#config_emailconfig_monitored_email_' + thisMailbox + '_folder';
                        var curVal = mQuery(folder).val();
                        mQuery(folder).html(response.folders);
                        mQuery(folder).val(curVal);
                        mQuery(folder).trigger('chosen:updated');
                    }
                });
            } else {
                var folder = '#config_emailconfig_monitored_email_' + mailbox + '_folder';
                var curVal = mQuery(folder).val();
                mQuery(folder).html(response.folders);
                mQuery(folder).val(curVal);
                mQuery(folder).trigger('chosen:updated');
            }
        }
    });
};
Mautic.testEmailServerConnection = function() {
    var data = {
        amazon_region: mQuery('#config_emailconfig_mailer_amazon_region').val(),
        amazon_other_region: mQuery('#config_emailconfig_mailer_amazon_other_region').val(),
        host: mQuery('#config_emailconfig_mailer_host').val(),
        api_key: mQuery('#config_emailconfig_mailer_api_key').val(),
        authMode: mQuery('#config_emailconfig_mailer_auth_mode').val(),
        encryption: mQuery('#config_emailconfig_mailer_encryption').val(),
        from_email: mQuery('#config_emailconfig_mailer_from_email').val(),
        from_name: mQuery('#config_emailconfig_mailer_from_name').val(),
        password: mQuery('#config_emailconfig_mailer_password').val(),
        port: mQuery('#config_emailconfig_mailer_port').val(),
        transport: mQuery('#config_emailconfig_mailer_transport').val(),
        user: mQuery('#config_emailconfig_mailer_user').val()
    };
    mQuery('#mailerTestButtonContainer .fa-spinner').removeClass('hide');
    Mautic.ajaxActionRequest('email:testEmailServerConnection', data, function(response) {
        var theClass = (response.success) ? 'has-success' : 'has-error';
        var theMessage = response.message;
        mQuery('#mailerTestButtonContainer').removeClass('has-success has-error').addClass(theClass);
        mQuery('#mailerTestButtonContainer .help-block .status-msg').html(theMessage);
        mQuery('#mailerTestButtonContainer .fa-spinner').addClass('hide');
    });
};
Mautic.sendTestEmail = function() {
    mQuery('#mailerTestButtonContainer .fa-spinner').removeClass('hide');
    Mautic.ajaxActionRequest('email:sendTestEmail', {}, function(response) {
        var theClass = (response.success) ? 'has-success' : 'has-error';
        var theMessage = response.message;
        mQuery('#mailerTestButtonContainer').removeClass('has-success has-error').addClass(theClass);
        mQuery('#mailerTestButtonContainer .help-block .status-msg').html(theMessage);
        mQuery('#mailerTestButtonContainer .fa-spinner').addClass('hide');
    });
};
Mautic.disableSendTestEmailButton = function() {
    mQuery('#mailerTestButtonContainer .help-block .status-msg').html('');
    mQuery('#mailerTestButtonContainer .help-block .save-config-msg').removeClass('hide');
    mQuery('#config_emailconfig_mailer_test_send_button').prop('disabled', true).addClass('disabled');
};;
Mautic.emailOnLoad = function(container, response) {
    if (mQuery('#emailform_plainText').length) {
        var plaintext = mQuery('#emailform_plainText');
        Mautic.initAtWho(plaintext, plaintext.attr('data-token-callback'));
        Mautic.initSelectTheme(mQuery('#emailform_template'));
        Mautic.initEmailDynamicContent();
        Mautic.prepareVersioning(function(content) {
            console.log('undo');
        }, function(content) {
            console.log('redo');
        });
        if (response && response.inBuilder) {
            Mautic.isInBuilder = true;
            Mautic.launchBuilder('emailform');
            Mautic.processBuilderErrors(response);
        }
    } else if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'email');
    }
    if (mQuery('table.email-list').length) {
        var ids = [];
        mQuery('td.col-stats').each(function() {
            var id = mQuery(this).attr('data-stats');
            ids.push(id);
        });
        while (ids.length > 0) {
            let batchIds = ids.splice(0, 10);
            Mautic.ajaxActionRequest('email:getEmailCountStats', {
                ids: batchIds
            }, function(response) {
                if (response.success && response.stats) {
                    for (var i = 0; i < response.stats.length; i++) {
                        var stat = response.stats[i];
                        if (mQuery('#sent-count-' + stat.id).length) {
                            if (stat.pending) {
                                mQuery('#pending-' + stat.id + ' > a').html(stat.pending);
                                mQuery('#pending-' + stat.id).removeClass('hide');
                            }
                            if (stat.queued) {
                                mQuery('#queued-' + stat.id + ' > a').html(stat.queued);
                                mQuery('#queued-' + stat.id).removeClass('hide');
                            }
                            mQuery('#sent-count-' + stat.id + ' > a').html(stat.sentCount);
                            mQuery('#read-count-' + stat.id + ' > a').html(stat.readCount);
                            mQuery('#read-percent-' + stat.id + ' > a').html(stat.readPercent);
                        }
                    }
                }
            }, false, true);
        }
    }
    if (mQuery('#emailGraphStats').length) {
        var graphUrl = mQuery('#emailGraphStats').attr('data-graph-url');
        mQuery("#emailGraphStats").load(graphUrl, function() {
            Mautic.renderCharts();
            Mautic.initDateRangePicker('#emailGraphStats #daterange_date_from', '#emailGraphStats #daterange_date_to');
        });
    }
};
Mautic.emailOnUnload = function(id) {
    if (id === '#app-content') {
        delete Mautic.listCompareChart;
    }
    if (typeof Mautic.ajaxActionXhrQueue !== 'undefined') {
        delete Mautic.ajaxActionXhrQueue['email:getEmailCountStats'];
    }
};
Mautic.insertEmailBuilderToken = function(editorId, token) {
    var editor = Mautic.getEmailBuilderEditorInstances();
    editor[instance].insertText(token);
};
Mautic.getEmailAbTestWinnerForm = function(abKey) {
    if (abKey && mQuery(abKey).val() && mQuery(abKey).closest('.form-group').hasClass('has-error')) {
        mQuery(abKey).closest('.form-group').removeClass('has-error');
        if (mQuery(abKey).next().hasClass('help-block')) {
            mQuery(abKey).next().remove();
        }
    }
    Mautic.activateLabelLoadingIndicator('emailform_variantSettings_winnerCriteria');
    var emailId = mQuery('#emailform_sessionId').val();
    var query = "action=email:getAbTestForm&abKey=" + mQuery(abKey).val() + "&emailId=" + emailId;
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            if (typeof response.html != 'undefined') {
                if (mQuery('#emailform_variantSettings_properties').length) {
                    mQuery('#emailform_variantSettings_properties').replaceWith(response.html);
                } else {
                    mQuery('#emailform_variantSettings').append(response.html);
                }
                if (response.html != '') {
                    Mautic.onPageLoad('#emailform_variantSettings_properties', response);
                }
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            Mautic.removeLabelLoadingIndicator();
        }
    });
};
Mautic.submitSendForm = function() {
    Mautic.dismissConfirmation();
    mQuery('.btn-send').prop('disabled', true);
    mQuery('form[name=\'batch_send\']').submit();
};
Mautic.emailSendOnLoad = function(container, response) {
    if (mQuery('.email-send-progress').length) {
        if (!mQuery('#emailSendProgress').length) {
            Mautic.clearModeratedInterval('emailSendProgress');
        } else {
            Mautic.setModeratedInterval('emailSendProgress', 'sendEmailBatch', 2000);
        }
    }
};
Mautic.emailSendOnUnload = function() {
    if (mQuery('.email-send-progress').length) {
        Mautic.clearModeratedInterval('emailSendProgress');
        if (typeof Mautic.sendEmailBatchXhr != 'undefined') {
            Mautic.sendEmailBatchXhr.abort();
            delete Mautic.sendEmailBatchXhr;
        }
    }
};
Mautic.sendEmailBatch = function() {
    var data = 'id=' + mQuery('.progress-bar-send').data('email') + '&pending=' + mQuery('.progress-bar-send').attr('aria-valuemax') + '&batchlimit=' + mQuery('.progress-bar-send').data('batchlimit');
    Mautic.sendEmailBatchXhr = Mautic.ajaxActionRequest('email:sendBatch', data, function(response) {
        if (response.progress) {
            if (response.progress[0] > 0) {
                mQuery('.imported-count').html(response.progress[0]);
                mQuery('.progress-bar-send').attr('aria-valuenow', response.progress[0]).css('width', response.percent + '%');
                mQuery('.progress-bar-send span.sr-only').html(response.percent + '%');
            }
            if (response.progress[0] >= response.progress[1]) {
                Mautic.clearModeratedInterval('emailSendProgress');
                setTimeout(function() {
                    mQuery.ajax({
                        type: 'POST',
                        showLoadingBar: false,
                        url: window.location,
                        data: 'complete=1',
                        success: function(response) {
                            if (response.newContent) {
                                Mautic.processPageContent(response);
                            }
                        }
                    });
                }, 1000);
            }
        }
        Mautic.moderatedIntervalCallbackIsComplete('emailSendProgress');
    });
};
Mautic.autoGeneratePlaintext = function() {
    mQuery('.plaintext-spinner').removeClass('hide');
    Mautic.ajaxActionRequest('email:generatePlaintText', {
        id: mQuery('#emailform_sessionId').val(),
        custom: mQuery('#emailform_customHtml').val()
    }, function(response) {
        mQuery('#emailform_plainText').val(response.text);
        mQuery('.plaintext-spinner').addClass('hide');
    });
};
Mautic.selectEmailType = function(emailType) {
    if (emailType == 'list') {
        mQuery('#leadList').removeClass('hide');
        mQuery('#segmentTranslationParent').removeClass('hide');
        mQuery('#templateTranslationParent').addClass('hide');
        mQuery('.page-header h3').text(mauticLang.newListEmail);
    } else {
        mQuery('#segmentTranslationParent').addClass('hide');
        mQuery('#templateTranslationParent').removeClass('hide');
        mQuery('#leadList').addClass('hide');
        mQuery('.page-header h3').text(mauticLang.newTemplateEmail);
    }
    mQuery('#emailform_emailType').val(emailType);
    mQuery('body').removeClass('noscroll');
    mQuery('.email-type-modal').remove();
    mQuery('.email-type-modal-backdrop').remove();
};
Mautic.getTotalAttachmentSize = function() {
    var assets = mQuery('#emailform_assetAttachments').val();
    if (assets) {
        assets = {
            'assets': assets
        };
        Mautic.ajaxActionRequest('email:getAttachmentsSize', assets, function(response) {
            mQuery('#attachment-size').text(response.size);
        });
    } else {
        mQuery('#attachment-size').text('0');
    }
};
Mautic.standardEmailUrl = function(options) {
    if (options && options.windowUrl && options.origin) {
        var url = options.windowUrl;
        var editEmailKey = '/emails/edit/emailId';
        var previewEmailKey = '/email/preview/emailId';
        if (url.indexOf(editEmailKey) > -1 || url.indexOf(previewEmailKey) > -1) {
            options.windowUrl = url.replace('emailId', mQuery(options.origin).val());
        }
    }
    return options;
};
Mautic.disabledEmailAction = function(opener, origin) {
    if (typeof opener == 'undefined') {
        opener = window;
    }
    var email = opener.mQuery(origin);
    if (email.length == 0) return;
    var emailId = email.val();
    var disabled = emailId === '' || emailId === null;
    opener.mQuery('[id$=_editEmailButton]').prop('disabled', disabled);
    opener.mQuery('[id$=_previewEmailButton]').prop('disabled', disabled);
};
Mautic.initEmailDynamicContent = function() {
    if (mQuery('#dynamic-content-container').length) {
        mQuery('#emailFilters .remove-selected').each(function(index, el) {
            mQuery(el).on('click', function() {
                mQuery(this).closest('.panel').animate({
                    'opacity': 0
                }, 'fast', function() {
                    mQuery(this).remove();
                });
                if (!mQuery('#emailFilters li:not(.placeholder)').length) {
                    mQuery('#emailFilters li.placeholder').removeClass('hide');
                } else {
                    mQuery('#emailFilters li.placeholder').addClass('hide');
                }
            });
        });
        mQuery('#addNewDynamicContent').on('click', function(e) {
            e.preventDefault();
            Mautic.createNewDynamicContentItem();
        });
        Mautic.initDynamicContentItem();
    }
};
Mautic.createNewDynamicContentItem = function(jQueryVariant) {
    var mQuery = (typeof jQueryVariant != 'undefined') ? jQueryVariant : window.mQuery;
    var tabHolder = mQuery('#dynamicContentTabs');
    var filterHolder = mQuery('#dynamicContentContainer');
    var dynamicContentPrototype = mQuery('#dynamicContentPrototype').data('prototype');
    var dynamicContentIndex = tabHolder.find('li').length - 1;
    while (mQuery('#emailform_dynamicContent_' + dynamicContentIndex).length > 0) {
        dynamicContentIndex++;
    }
    var tabId = '#emailform_dynamicContent_' + dynamicContentIndex;
    var tokenName = 'Dynamic Content ' + (dynamicContentIndex + 1);
    var newForm = dynamicContentPrototype.replace(/__name__/g, dynamicContentIndex);
    var newTab = mQuery('<li><a role="tab" data-toggle="tab" href="' + tabId + '">' + tokenName + '</a></li>');
    tabHolder.append(newTab);
    filterHolder.append(newForm);
    var itemContainer = mQuery(tabId);
    var textarea = itemContainer.find('.editor');
    var firstInput = itemContainer.find('input[type="text"]').first();
    textarea.froalaEditor(mQuery.extend({}, Mautic.basicFroalaOptions, {
        toolbarSticky: false,
        toolbarButtons: ['undo', 'redo', '|', 'bold', 'italic', 'underline', 'paragraphFormat', 'fontFamily', 'fontSize', 'color', 'align', 'formatOL', 'formatUL', 'quote', 'clearFormatting', 'token', 'insertLink', 'insertImage', 'insertTable', 'html', 'fullscreen'],
        heightMin: 100
    }));
    tabHolder.find('i').first().removeClass('fa-spinner fa-spin').addClass('fa-plus text-success');
    newTab.find('a').tab('show');
    firstInput.focus();
    Mautic.updateDynamicContentDropdown();
    Mautic.initDynamicContentItem(tabId, mQuery, tokenName);
    return tabId;
};
Mautic.createNewDynamicContentFilter = function(el, jQueryVariant) {
    var mQuery = (typeof jQueryVariant != 'undefined') ? jQueryVariant : window.mQuery;
    var $this = mQuery(el);
    var parentElement = $this.parents('.panel');
    var tabHolder = parentElement.find('.nav');
    var filterHolder = parentElement.find('.tab-content');
    var filterBlockPrototype = mQuery('#filterBlockPrototype');
    var filterIndex = filterHolder.find('.tab-pane').length - 1;
    var dynamicContentIndex = $this.parents('.tab-pane').attr('id').match(/\d+$/)[0];
    var filterPrototype = filterBlockPrototype.data('prototype');
    var filterContainerId = '#emailform_dynamicContent_' + dynamicContentIndex + '_filters_' + filterIndex;
    while (mQuery(filterContainerId).length > 0) {
        filterIndex++;
        filterContainerId = '#emailform_dynamicContent_' + dynamicContentIndex + '_filters_' + filterIndex;
    }
    var newTab = mQuery('<li><a role="tab" data-toggle="tab" href="' + filterContainerId + '">Variation ' + (filterIndex + 1) + '</a></li>');
    var newForm = filterPrototype.replace(/__name__/g, filterIndex).replace(/dynamicContent_0_filters/g, 'dynamicContent_' + dynamicContentIndex + '_filters').replace(/dynamicContent]\[0]\[filters/g, 'dynamicContent][' + dynamicContentIndex + '][filters');
    tabHolder.append(newTab);
    filterHolder.append(newForm);
    var filterContainer = mQuery(filterContainerId);
    var availableFilters = filterContainer.find('select[data-mautic="available_filters"]');
    var altTextarea = filterContainer.find('.editor');
    var removeButton = filterContainer.find('.remove-item');
    Mautic.activateChosenSelect(availableFilters, false, mQuery);
    availableFilters.on('change', function() {
        var $this = mQuery(this);
        if ($this.val()) {
            Mautic.addDynamicContentFilter($this.val(), mQuery);
            $this.val('');
            $this.trigger('chosen:updated');
        }
    });
    altTextarea.froalaEditor(mQuery.extend({}, Mautic.basicFroalaOptions, {
        toolbarSticky: false,
        toolbarButtons: ['undo', 'redo', '|', 'bold', 'italic', 'underline', 'paragraphFormat', 'fontFamily', 'fontSize', 'color', 'align', 'formatOL', 'formatUL', 'quote', 'clearFormatting', 'token', 'insertLink', 'insertImage', 'insertTable', 'html', 'fullscreen'],
        heightMin: 100
    }));
    Mautic.initRemoveEvents(removeButton, mQuery);
    newTab.find('a').tab('show');
    return filterContainerId;
};
Mautic.initDynamicContentItem = function(tabId, jQueryVariant, tokenName) {
    var mQuery = (typeof jQueryVariant != 'undefined') ? jQueryVariant : window.mQuery;
    var $el = mQuery('#dynamic-content-container');
    if ($el.length === 0) {
        mQuery = parent.mQuery;
        $el = mQuery('#dynamic-content-container');
    }
    if (tabId || typeof tabId != "undefined") {
        $el = mQuery(tabId);
    }
    $el.find('.addNewDynamicContentFilter').on('click', function(e) {
        e.preventDefault();
        Mautic.createNewDynamicContentFilter(this);
    });
    if (typeof tokenName != 'undefined') {
        $el.find('.dynamic-content-token-name').val(tokenName);
    }
    if ($el.find('.dynamic-content-token-name').val() === '') {
        var dynamicContent = $el.attr('id').match(/\d+$/);
        if (dynamicContent) {
            var dynamicContentIndex = dynamicContent[0];
            $el.find('.dynamic-content-token-name').val('Dynamic Content ' + dynamicContentIndex);
        }
    }
    $el.find('a.remove-selected').on('click', function() {
        mQuery(this).closest('.panel').animate({
            'opacity': 0
        }, 'fast', function() {
            mQuery(this).remove();
        });
    });
    $el.find('select[data-mautic="available_filters"]').on('change', function() {
        var $this = mQuery(this);
        if ($this.val()) {
            Mautic.addDynamicContentFilter($this.val(), mQuery);
            $this.val('');
            $this.trigger('chosen:updated');
        }
    });
    Mautic.initRemoveEvents($el.find('.remove-item'), mQuery);
};
Mautic.updateDynamicContentDropdown = function() {
    var options = [];
    mQuery('#dynamicContentTabs').find('a[data-toggle="tab"]').each(function() {
        var prototype = '<li><a class="fr-command" data-cmd="dynamicContent" data-param1="__tokenName__">__tokenName__</a></li>';
        var newOption = prototype.replace(/__tokenName__/g, mQuery(this).text());
        options.push(newOption);
    });
    mQuery('button[data-cmd="dynamicContent"]').next().find('ul').html(options.join(''));
};
Mautic.initRemoveEvents = function(elements, jQueryVariant) {
    var mQuery = (typeof jQueryVariant != 'undefined') ? jQueryVariant : window.mQuery;
    if (elements.hasClass('remove-selected')) {
        elements.on('click', function() {
            mQuery(this).closest('.panel').animate({
                'opacity': 0
            }, 'fast', function() {
                mQuery(this).remove();
            });
        });
    } else {
        elements.on('click', function(e) {
            e.preventDefault();
            var $this = mQuery(this);
            var parentElement = $this.parents('.tab-pane.dynamic-content');
            if ($this.hasClass('remove-filter')) {
                parentElement = $this.parents('.tab-pane.dynamic-content-filter');
            }
            var tabLink = mQuery('a[href="#' + parentElement.attr('id') + '"]').parent();
            var tabContainer = tabLink.parent();
            parentElement.remove();
            tabLink.remove();
            if (tabContainer.hasClass('tabs-left') || $this.hasClass('remove-filter')) {
                tabContainer.find('li').first().next().find('a').tab('show');
            } else {
                tabContainer.find('li').first().find('a').tab('show');
            }
            Mautic.updateDynamicContentDropdown();
        });
    }
};
Mautic.addDynamicContentFilter = function(selectedFilter, jQueryVariant) {
    var mQuery = (typeof jQueryVariant != 'undefined') ? jQueryVariant : window.mQuery;
    var dynamicContentItems = mQuery('.tab-pane.dynamic-content');
    var activeDynamicContent = dynamicContentItems.filter(':visible');
    var dynamicContentIndex = activeDynamicContent.attr('id').match(/\d+$/)[0];
    var dynamicContentFilterContainers = activeDynamicContent.find('div[data-filter-container]');
    var activeDynamicContentFilterContainer = dynamicContentFilterContainers.filter(':visible');
    var dynamicContentFilterIndex = dynamicContentFilterContainers.index(activeDynamicContentFilterContainer);
    var selectedOption = mQuery('option[data-mautic="available_' + selectedFilter + '"]').first();
    var label = selectedOption.text();
    var filterNum = activeDynamicContentFilterContainer.children('.panel').length;
    var prototype = mQuery('#filterSelectPrototype').data('prototype');
    var fieldObject = selectedOption.data('field-object');
    var fieldType = selectedOption.data('field-type');
    var isSpecial = (mQuery.inArray(fieldType, ['leadlist', 'assets', 'lead_email_received', 'tags', 'multiselect', 'boolean', 'select', 'country', 'timezone', 'region', 'stage', 'locale']) != -1);
    prototype = prototype.replace(/__name__/g, filterNum).replace(/__label__/g, label).replace(/dynamicContent_0_filters/g, 'dynamicContent_' + dynamicContentIndex + '_filters').replace(/dynamicContent]\[0]\[filters/g, 'dynamicContent][' + dynamicContentIndex + '][filters').replace(/filters_0_filters/g, 'filters_' + dynamicContentFilterIndex + '_filters').replace(/filters]\[0]\[filters/g, 'filters][' + dynamicContentFilterIndex + '][filters');
    if (filterNum === 0) {
        prototype = prototype.replace(/in-group/g, '');
    }
    prototype = mQuery(prototype);
    if (fieldObject == 'company') {
        prototype.find('.object-icon').removeClass('fa-user').addClass('fa-building');
    } else {
        prototype.find('.object-icon').removeClass('fa-building').addClass('fa-user');
    }
    var filterBase = "emailform[dynamicContent][" + dynamicContentIndex + "][filters][" + dynamicContentFilterIndex + "][filters][" + filterNum + "]";
    var filterIdBase = "emailform_dynamicContent_" + dynamicContentIndex + "_filters_" + dynamicContentFilterIndex + "_filters_" + filterNum;
    if (isSpecial) {
        var templateField = fieldType;
        if (fieldType == 'boolean' || fieldType == 'multiselect') {
            templateField = 'select';
        }
        var template = mQuery('#templates .' + templateField + '-template').clone();
        var $template = mQuery(template);
        var templateNameAttr = $template.attr('name').replace(/__name__/g, filterNum).replace(/__dynamicContentIndex__/g, dynamicContentIndex).replace(/__dynamicContentFilterIndex__/g, dynamicContentFilterIndex);
        var templateIdAttr = $template.attr('id').replace(/__name__/g, filterNum).replace(/__dynamicContentIndex__/g, dynamicContentIndex).replace(/__dynamicContentFilterIndex__/g, dynamicContentFilterIndex);
        $template.attr('name', templateNameAttr);
        $template.attr('id', templateIdAttr);
        prototype.find('input[name="' + filterBase + '[filter]"]').replaceWith(template);
    }
    if (activeDynamicContentFilterContainer.find('.panel').length == 0) {
        prototype.find(".panel-footer").addClass('hide');
    }
    prototype.find("input[name='" + filterBase + "[field]']").val(selectedFilter);
    prototype.find("input[name='" + filterBase + "[type]']").val(fieldType);
    prototype.find("input[name='" + filterBase + "[object]']").val(fieldObject);
    var filterEl = (isSpecial) ? "select[name='" + filterBase + "[filter]']" : "input[name='" + filterBase + "[filter]']";
    activeDynamicContentFilterContainer.append(prototype);
    Mautic.initRemoveEvents(activeDynamicContentFilterContainer.find("a.remove-selected"), mQuery);
    var filter = '#' + filterIdBase + '_filter';
    var fieldOptions = fieldCallback = '';
    if (isSpecial) {
        if (fieldType == 'select' || fieldType == 'boolean' || fieldType == 'multiselect') {
            fieldOptions = selectedOption.data("field-list");
            mQuery.each(fieldOptions, function(index, val) {
                mQuery('<option>').val(index).text(val).appendTo(filterEl);
            });
        }
    } else if (fieldType == 'lookup') {
        fieldCallback = selectedOption.data("field-callback");
        if (fieldCallback && typeof Mautic[fieldCallback] == 'function') {
            fieldOptions = selectedOption.data("field-list");
            Mautic[fieldCallback](filterIdBase + '_filter', selectedFilter, fieldOptions);
        }
    } else if (fieldType == 'datetime') {
        mQuery(filter).datetimepicker({
            format: 'Y-m-d H:i',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false
        });
    } else if (fieldType == 'date') {
        mQuery(filter).datetimepicker({
            timepicker: false,
            format: 'Y-m-d',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false,
            closeOnDateSelect: true
        });
    } else if (fieldType == 'time') {
        mQuery(filter).datetimepicker({
            datepicker: false,
            format: 'H:i',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false
        });
    } else if (fieldType == 'lookup_id') {
        var oldFilter = mQuery(filterEl);
        var newDisplay = mQuery(oldFilter).clone();
        mQuery(newDisplay).attr('name', filterBase + '[display]').attr('id', filterIdBase + '_display');
        var oldDisplay = mQuery(prototype).find("input[name='" + filterBase + "[display]']");
        var newFilter = mQuery(oldDisplay).clone();
        mQuery(newFilter).attr('name', filterBase + '[filter]').attr('id', filterIdBase + '_filter');
        mQuery(oldFilter).replaceWith(newFilter);
        mQuery(oldDisplay).replaceWith(newDisplay);
        var fieldCallback = selectedOption.data("field-callback");
        if (fieldCallback && typeof Mautic[fieldCallback] == 'function') {
            fieldOptions = selectedOption.data("field-list");
            Mautic[fieldCallback](filterIdBase + '_display', selectedFilter, fieldOptions, mQuery);
        }
    } else {
        mQuery(filter).attr('type', fieldType);
    }
    var operators = mQuery(selectedOption).data('field-operators');
    mQuery('#' + filterIdBase + '_operator').html('');
    mQuery.each(operators, function(value, label) {
        var newOption = mQuery('<option/>').val(value).text(label);
        newOption.appendTo(mQuery('#' + filterIdBase + '_operator'));
    });
    Mautic.convertDynamicContentFilterInput('#' + filterIdBase + '_operator', mQuery);
};
Mautic.convertDynamicContentFilterInput = function(el, jQueryVariant) {
    var mQuery = (typeof jQueryVariant != 'undefined') ? jQueryVariant : window.mQuery;
    var operator = mQuery(el).val();
    var regExp = /emailform_dynamicContent_(\d+)_filters_(\d+)_filters_(\d+)_operator/;
    var matches = regExp.exec(mQuery(el).attr('id'));
    var dynamicContentIndex = matches[1];
    var dynamicContentFilterIndex = matches[2];
    var filterNum = matches[3];
    var filterId = '#emailform_dynamicContent_' + dynamicContentIndex + '_filters_' + dynamicContentFilterIndex + '_filters_' + filterNum + '_filter';
    var filterEl = mQuery(filterId);
    var filterElParent = filterEl.parent();
    if (filterElParent.hasClass('has-error')) {
        filterElParent.find('div.help-block').hide();
        filterElParent.removeClass('has-error');
    }
    var disabled = (operator == 'empty' || operator == '!empty');
    filterEl.prop('disabled', disabled);
    if (disabled) {
        filterEl.val('');
    }
    var newName = '';
    var lastPos;
    if (filterEl.is('select')) {
        var isMultiple = filterEl.attr('multiple');
        var multiple = (operator == 'in' || operator == '!in');
        var placeholder = filterEl.attr('data-placeholder');
        if (multiple && !isMultiple) {
            filterEl.attr('multiple', 'multiple');
            newName = filterEl.attr('name') + '[]';
            filterEl.attr('name', newName);
            placeholder = mauticLang['chosenChooseMore'];
        } else if (!multiple && isMultiple) {
            filterEl.removeAttr('multiple');
            newName = filterEl.attr('name');
            lastPos = newName.lastIndexOf('[]');
            newName = newName.substring(0, lastPos);
            filterEl.attr('name', newName);
            placeholder = mauticLang['chosenChooseOne'];
        }
        if (multiple) {
            filterEl.find('option[value=""]').remove();
            filterEl.find('option:selected').removeAttr('selected');
        } else {
            filterEl.prepend("<option value='' selected></option>");
        }
        Mautic.destroyChosen(filterEl);
        filterEl.attr('data-placeholder', placeholder);
        Mautic.activateChosenSelect(filterEl, false, mQuery);
    }
};;
Mautic.formOnLoad = function(container) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'form.form');
    }
    var bodyOverflow = {};
    mQuery('select.form-builder-new-component').change(function(e) {
        mQuery(this).find('option:selected');
        Mautic.ajaxifyModal(mQuery(this).find('option:selected'));
        mQuery(this).val('');
        mQuery(this).trigger('chosen:updated');
    });
    if (mQuery('#mauticforms_fields')) {
        mQuery('#mauticforms_fields').sortable({
            items: '.panel',
            cancel: '',
            helper: function(e, ui) {
                ui.children().each(function() {
                    mQuery(this).width(mQuery(this).width());
                });
                bodyOverflow.overflowX = mQuery('body').css('overflow-x');
                bodyOverflow.overflowY = mQuery('body').css('overflow-y');
                mQuery('body').css({
                    overflowX: 'visible',
                    overflowY: 'visible'
                });
                return ui;
            },
            scroll: true,
            axis: 'y',
            containment: '#mauticforms_fields .drop-here',
            stop: function(e, ui) {
                mQuery('body').css(bodyOverflow);
                mQuery(ui.item).attr('style', '');
                mQuery.ajax({
                    type: "POST",
                    url: mauticAjaxUrl + "?action=form:reorderFields",
                    data: mQuery('#mauticforms_fields').sortable("serialize", {
                        attribute: 'data-sortable-id'
                    }) + "&formId=" + mQuery('#mauticform_sessionId').val()
                });
            }
        });
        Mautic.initFormFieldButtons();
    }
    if (mQuery('#mauticforms_actions')) {
        mQuery('#mauticforms_actions').sortable({
            items: '.panel',
            cancel: '',
            helper: function(e, ui) {
                ui.children().each(function() {
                    mQuery(this).width(mQuery(this).width());
                });
                bodyOverflow.overflowX = mQuery('body').css('overflow-x');
                bodyOverflow.overflowY = mQuery('body').css('overflow-y');
                mQuery('body').css({
                    overflowX: 'visible',
                    overflowY: 'visible'
                });
                return ui;
            },
            scroll: true,
            axis: 'y',
            containment: '#mauticforms_actions .drop-here',
            stop: function(e, ui) {
                mQuery('body').css(bodyOverflow);
                mQuery(ui.item).attr('style', '');
                mQuery.ajax({
                    type: "POST",
                    url: mauticAjaxUrl + "?action=form:reorderActions",
                    data: mQuery('#mauticforms_actions').sortable("serialize") + "&formId=" + mQuery('#mauticform_sessionId').val()
                });
            }
        });
        mQuery('#mauticforms_actions .mauticform-row').on('dblclick.mauticformactions', function(event) {
            event.preventDefault();
            mQuery(this).find('.btn-edit').first().click();
        });
    }
    if (mQuery('#mauticform_formType').length && mQuery('#mauticform_formType').val() == '') {
        mQuery('body').addClass('noscroll');
    }
    Mautic.initHideItemButton('#mauticforms_fields');
    Mautic.initHideItemButton('#mauticforms_actions');
};
Mautic.updateFormFields = function() {
    Mautic.activateLabelLoadingIndicator('campaignevent_properties_field');
    var formId = mQuery('#campaignevent_properties_form').val();
    Mautic.ajaxActionRequest('form:updateFormFields', {
        'formId': formId
    }, function(response) {
        if (response.fields) {
            var select = mQuery('#campaignevent_properties_field');
            select.find('option').remove();
            var fieldOptions = {};
            mQuery.each(response.fields, function(key, field) {
                var option = mQuery('<option></option>').attr('value', field.alias).text(field.label);
                select.append(option);
                fieldOptions[field.alias] = field.options;
            });
            select.attr('data-field-options', JSON.stringify(fieldOptions));
            select.trigger('chosen:updated');
            Mautic.updateFormFieldValues(select);
        }
        Mautic.removeLabelLoadingIndicator();
    });
};
Mautic.updateFormFieldValues = function(field) {
    field = mQuery(field);
    var fieldValue = field.val();
    var options = jQuery.parseJSON(field.attr('data-field-options'));
    var valueField = mQuery('#campaignevent_properties_value');
    var valueFieldAttrs = {
        'class': valueField.attr('class'),
        'id': valueField.attr('id'),
        'name': valueField.attr('name'),
        'autocomplete': valueField.attr('autocomplete'),
        'value': valueField.attr('value')
    };
    if (typeof options[fieldValue] !== 'undefined' && !mQuery.isEmptyObject(options[fieldValue])) {
        var newValueField = mQuery('<select/>').attr('class', valueFieldAttrs['class']).attr('id', valueFieldAttrs['id']).attr('name', valueFieldAttrs['name']).attr('autocomplete', valueFieldAttrs['autocomplete']).attr('value', valueFieldAttrs['value']);
        mQuery.each(options[fieldValue], function(key, optionVal) {
            var option = mQuery("<option></option>").attr('value', key).text(optionVal);
            newValueField.append(option);
        });
        valueField.replaceWith(newValueField);
    } else {
        var newValueField = mQuery('<input/>').attr('type', 'text').attr('class', valueFieldAttrs['class']).attr('id', valueFieldAttrs['id']).attr('name', valueFieldAttrs['name']).attr('autocomplete', valueFieldAttrs['autocomplete']).attr('value', valueFieldAttrs['value']);
        valueField.replaceWith(newValueField);
    }
};
Mautic.formFieldOnLoad = function(container, response) {
    if (response.fieldHtml) {
        var newHtml = response.fieldHtml;
        var fieldId = '#mauticform_' + response.fieldId;
        var fieldContainer = mQuery(fieldId).closest('.form-field-wrapper');
        if (mQuery(fieldId).length) {
            mQuery(fieldContainer).replaceWith(newHtml);
            var newField = false;
        } else {
            var panel = mQuery('#mauticforms_fields .mauticform-button-wrapper').closest('.form-field-wrapper');
            panel.before(newHtml);
            var newField = true;
        }
        var fieldContainer = mQuery(fieldId).closest('.form-field-wrapper');
        mQuery(fieldContainer).find("[data-toggle='ajax']").click(function(event) {
            event.preventDefault();
            return Mautic.ajaxifyLink(this, event);
        });
        mQuery(fieldContainer).find("*[data-toggle='tooltip']").tooltip({
            html: true
        });
        mQuery(fieldContainer).find("[data-toggle='ajaxmodal']").on('click.ajaxmodal', function(event) {
            event.preventDefault();
            Mautic.ajaxifyModal(this, event);
        });
        Mautic.initFormFieldButtons(fieldContainer);
        Mautic.initHideItemButton(fieldContainer);
        if (!mQuery('#fields-panel').hasClass('in')) {
            mQuery('a[href="#fields-panel"]').trigger('click');
        }
        if (newField) {
            mQuery('.bundle-main-inner-wrapper').scrollTop(mQuery('.bundle-main-inner-wrapper').height());
        }
        if (mQuery('#form-field-placeholder').length) {
            mQuery('#form-field-placeholder').remove();
        }
    }
};
Mautic.initFormFieldButtons = function(container) {
    if (typeof container == 'undefined') {
        mQuery('#mauticforms_fields .mauticform-row').off(".mauticformfields");
        var container = '#mauticforms_fields';
    }
    mQuery(container).find('.mauticform-row').on('dblclick.mauticformfields', function(event) {
        event.preventDefault();
        mQuery(this).closest('.form-field-wrapper').find('.btn-edit').first().click();
    });
};
Mautic.formActionOnLoad = function(container, response) {
    if (response.actionHtml) {
        var newHtml = response.actionHtml;
        var actionId = '#mauticform_action_' + response.actionId;
        if (mQuery(actionId).length) {
            mQuery(actionId).replaceWith(newHtml);
            var newField = false;
        } else {
            mQuery(newHtml).appendTo('#mauticforms_actions');
            var newField = true;
        }
        mQuery(actionId + " [data-toggle='ajax']").click(function(event) {
            event.preventDefault();
            return Mautic.ajaxifyLink(this, event);
        });
        mQuery(actionId + " *[data-toggle='tooltip']").tooltip({
            html: true
        });
        mQuery(actionId + " [data-toggle='ajaxmodal']").on('click.ajaxmodal', function(event) {
            event.preventDefault();
            Mautic.ajaxifyModal(this, event);
        });
        Mautic.initHideItemButton(actionId);
        mQuery('#mauticforms_actions .mauticform-row').off(".mauticform");
        mQuery('#mauticforms_actions .mauticform-row').on('dblclick.mauticformactions', function(event) {
            event.preventDefault();
            mQuery(this).find('.btn-edit').first().click();
        });
        if (!mQuery('#actions-panel').hasClass('in')) {
            mQuery('a[href="#actions-panel"]').trigger('click');
        }
        if (newField) {
            mQuery('.bundle-main-inner-wrapper').scrollTop(mQuery('.bundle-main-inner-wrapper').height());
        }
        if (mQuery('#form-action-placeholder').length) {
            mQuery('#form-action-placeholder').remove();
        }
    }
};
Mautic.initHideItemButton = function(container) {
    mQuery(container).find('[data-hide-panel]').click(function(e) {
        e.preventDefault();
        mQuery(this).closest('.panel').hide('fast');
    });
}
Mautic.onPostSubmitActionChange = function(value) {
    if (value == 'return') {
        mQuery('#mauticform_postActionProperty').prev().removeClass('required');
    } else {
        mQuery('#mauticform_postActionProperty').prev().addClass('required');
    }
    mQuery('#mauticform_postActionProperty').next().html('');
    mQuery('#mauticform_postActionProperty').parent().removeClass('has-error');
};
Mautic.selectFormType = function(formType) {
    if (formType == 'standalone') {
        mQuery('option.action-standalone-only').removeClass('hide');
        mQuery('.page-header h3').text(mauticLang.newStandaloneForm);
    } else {
        mQuery('option.action-standalone-only').addClass('hide');
        mQuery('.page-header h3').text(mauticLang.newCampaignForm);
    }
    mQuery('.available-actions select').trigger('chosen:updated');
    mQuery('#mauticform_formType').val(formType);
    mQuery('body').removeClass('noscroll');
    mQuery('.form-type-modal').remove();
    mQuery('.form-type-modal-backdrop').remove();
};;
Mautic.integrationsConfigOnLoad = function() {
    mQuery('.integration-keyword-filter').each(function() {
        mQuery(this).off("keydown.integration-filter").on("keydown.integration-filter", function(event) {
            if (event.which == 13) {
                var integration = mQuery(this).attr('data-integration');
                var object = mQuery(this).attr('data-object');
                Mautic.getPaginatedIntegrationFields({
                    'integration': integration,
                    'object': object,
                    'keyword': mQuery(this).val()
                }, 1, this);
            }
        });
    });
    Mautic.activateIntegrationFieldUpdateActions();
};
Mautic.getPaginatedIntegrationFields = function(settings, page, element) {
    var requestName = settings.integration + '-' + settings.object;
    var action = mauticBaseUrl + 's/integration/' + settings.integration + '/config/' + settings.object + '/' + page;
    if (settings.keyword) {
        action = action + '?keyword=' + settings.keyword;
    }
    if (typeof Mautic.activeActions == 'undefined') {
        Mautic.activeActions = {};
    } else if (typeof Mautic.activeActions[requestName] != 'undefined') {
        Mautic.activeActions[requestName].abort();
    }
    var object = settings.object;
    var fieldsTab = '#field-mappings-' + object + '-container';
    if (element && mQuery(element).is('input')) {
        Mautic.activateLabelLoadingIndicator(mQuery(element).attr('id'));
    }
    var fieldsContainer = '#field-mappings-' + object;
    var modalId = '#' + mQuery(fieldsContainer).closest('.modal').attr('id');
    Mautic.startModalLoadingBar(modalId);
    Mautic.activeActions[requestName] = mQuery.ajax({
        showLoadingBar: false,
        url: action,
        type: "POST",
        dataType: "json",
        success: function(response) {
            if (response.success) {
                mQuery(fieldsContainer).html(response.html);
                Mautic.onPageLoad(fieldsContainer);
                Mautic.activateIntegrationFieldUpdateActions();
                if (mQuery(fieldsTab).length) {
                    mQuery(fieldsTab).removeClass('hide');
                }
            } else if (mQuery(fieldsTab).length) {
                mQuery(fieldsTab).addClass('hide');
            }
            if (element) {
                Mautic.removeLabelLoadingIndicator();
            }
            Mautic.stopModalLoadingBar(modalId);
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            delete Mautic.activeActions[requestName]
        }
    });
};
Mautic.updateIntegrationField = function(integration, object, field, fieldOption, fieldValue) {
    var action = mauticBaseUrl + 's/integration/' + integration + '/config/' + object + '/field/' + field;
    var modal = mQuery('form[name=integration_config]').closest('.modal');
    var requestName = integration + object + field + fieldOption;
    mQuery(modal).find('.modal-form-buttons .btn').prop('disabled', true);
    if (typeof Mautic.activeActions == 'undefined') {
        Mautic.activeActions = {};
    } else if (typeof Mautic.activeActions[requestName] != 'undefined') {
        Mautic.activeActions[requestName].abort();
    }
    Mautic.startModalLoadingBar(mQuery(modal).attr('id'));
    var obj = {};
    obj[fieldOption] = fieldValue;
    Mautic.activeActions[requestName] = mQuery.ajax({
        showLoadingBar: false,
        url: action,
        type: "POST",
        dataType: "json",
        data: obj,
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            modal.find('.modal-form-buttons .btn').prop('disabled', false);
            delete Mautic.activeActions[requestName];
        }
    });
};
Mautic.activateIntegrationFieldUpdateActions = function() {
    mQuery('.integration-mapped-field').each(function() {
        mQuery(this).off("change.integration-mapped-field").on("change.integration-mapped-field", function(event) {
            var integration = mQuery(this).attr('data-integration');
            var object = mQuery(this).attr('data-object');
            var field = mQuery(this).attr('data-field');
            Mautic.updateIntegrationField(integration, object, field, 'mappedField', mQuery(this).val());
        });
    });
    mQuery('.integration-sync-direction').each(function() {
        mQuery(this).off("change.integration-sync-direction").on("change.integration-sync-direction", function(event) {
            var integration = mQuery(this).attr('data-integration');
            var object = mQuery(this).attr('data-object');
            var field = mQuery(this).attr('data-field');
            Mautic.updateIntegrationField(integration, object, field, 'syncDirection', mQuery(this).val());
        });
    });
};
Mautic.authorizeIntegration = function() {
    mQuery('#integration_details_in_auth').val(1);
    Mautic.postForm(mQuery('form[name="integration_config"]'), 'loadIntegrationAuthWindow');
};;
Mautic.leadOnLoad = function(container, response) {
    Mautic.addKeyboardShortcut('a', 'Quick add a New Contact', function(e) {
        if (mQuery('a.quickadd').length) {
            mQuery('a.quickadd').click();
        } else if (mQuery('a.btn-leadnote-add').length) {
            mQuery('a.btn-leadnote-add').click();
        }
    }, 'contact pages');
    Mautic.addKeyboardShortcut('t', 'Activate Table View', function(e) {
        mQuery('#table-view').click();
    }, 'contact pages');
    Mautic.addKeyboardShortcut('c', 'Activate Card View', function(e) {
        mQuery('#card-view').click();
    }, 'contact pages');
    Mousetrap.stopCallback = function(e, element, combo) {
        if (element.id == 'leadnote_text' && combo != 'mod+enter') {
            return true;
        }
        if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
            return false;
        }
        return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || (element.contentEditable && element.contentEditable == 'true');
    };
    var timelineForm = mQuery(container + ' #timeline-filters');
    if (timelineForm.length) {
        timelineForm.on('change', function() {
            timelineForm.submit();
        }).on('keyup', function() {
            timelineForm.delay(200).submit();
        }).on('submit', function(e) {
            e.preventDefault();
            Mautic.refreshLeadTimeline(timelineForm);
        });
        var toggleTimelineDetails = function(el) {
            var activateDetailsState = mQuery(el).hasClass('active');
            if (activateDetailsState) {
                mQuery('#timeline-details-' + detailsId).addClass('hide');
                mQuery(el).removeClass('active');
            } else {
                mQuery('#timeline-details-' + detailsId).removeClass('hide');
                mQuery(el).addClass('active');
            }
        };
        Mautic.leadTimelineOnLoad(container, response);
        Mautic.leadAuditlogOnLoad(container, response);
    }
    var auditlogForm = mQuery(container + ' #auditlog-filters');
    if (auditlogForm.length) {
        auditlogForm.on('change', function() {
            auditlogForm.submit();
        }).on('keyup', function() {
            auditlogForm.delay(200).submit();
        }).on('submit', function(e) {
            e.preventDefault();
            Mautic.refreshLeadAuditLog(auditlogForm);
        });
    }
    var noteForm = mQuery(container + ' #note-filters');
    if (noteForm.length) {
        noteForm.on('change', function() {
            noteForm.submit();
        }).on('keyup', function() {
            noteForm.delay(200).submit();
        }).on('submit', function(e) {
            e.preventDefault();
            Mautic.refreshLeadNotes(noteForm);
        });
    }
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'lead.lead');
    }
    if (mQuery(container + ' #notes-container').length) {
        Mautic.activateSearchAutocomplete('NoteFilter', 'lead.note');
    }
    if (mQuery('#lead_preferred_profile_image').length) {
        mQuery('#lead_preferred_profile_image').on('change', function() {
            if (mQuery(this).val() == 'custom') {
                mQuery('#customAvatarContainer').slideDown('fast');
            } else {
                mQuery('#customAvatarContainer').slideUp('fast');
            }
        })
    }
    if (mQuery('.lead-avatar-panel').length) {
        mQuery('.lead-avatar-panel .avatar-collapser a.arrow').on('click', function() {
            setTimeout(function() {
                var status = (mQuery('#lead-avatar-block').hasClass('in') ? 'expanded' : 'collapsed');
                Cookies.set('mautic_lead_avatar_panel', status, {
                    expires: 30
                });
            }, 500);
        });
    }
    if (mQuery('#anonymousLeadButton').length) {
        var searchValue = mQuery('#list-search').typeahead('val').toLowerCase();
        var string = mQuery('#anonymousLeadButton').data('anonymous').toLowerCase();
        if (searchValue.indexOf(string) >= 0 && searchValue.indexOf('!' + string) == -1) {
            mQuery('#anonymousLeadButton').addClass('btn-primary');
        } else {
            mQuery('#anonymousLeadButton').removeClass('btn-primary');
        }
    }
    var leadMap = [];
    mQuery(document).on('shown.bs.tab', 'a#load-lead-map', function(e) {
        leadMap = Mautic.renderMap(mQuery('#place-container .vector-map'));
    });
    mQuery('a[data-toggle="tab"]').not('a#load-lead-map').on('shown.bs.tab', function(e) {
        if (leadMap.length) {
            Mautic.destroyMap(leadMap);
            leadMap = [];
        }
    });
    Mautic.initUniqueIdentifierFields();
    if (mQuery(container + ' .panel-companies').length) {
        mQuery(container + ' .panel-companies .fa-check').tooltip({
            html: true
        });
    }
};
Mautic.leadTimelineOnLoad = function(container, response) {
    mQuery("#contact-timeline a[data-activate-details='all']").on('click', function() {
        if (mQuery(this).find('span').first().hasClass('fa-level-down')) {
            mQuery("#contact-timeline a[data-activate-details!='all']").each(function() {
                var detailsId = mQuery(this).data('activate-details');
                if (detailsId && mQuery('#timeline-details-' + detailsId).length) {
                    mQuery('#timeline-details-' + detailsId).removeClass('hide');
                    mQuery(this).addClass('active');
                }
            });
            mQuery(this).find('span').first().removeClass('fa-level-down').addClass('fa-level-up');
        } else {
            mQuery("#contact-timeline a[data-activate-details!='all']").each(function() {
                var detailsId = mQuery(this).data('activate-details');
                if (detailsId && mQuery('#timeline-details-' + detailsId).length) {
                    mQuery('#timeline-details-' + detailsId).addClass('hide');
                    mQuery(this).removeClass('active');
                }
            });
            mQuery(this).find('span').first().removeClass('fa-level-up').addClass('fa-level-down');
        }
    });
    mQuery("#contact-timeline a[data-activate-details!='all']").on('click', function() {
        var detailsId = mQuery(this).data('activate-details');
        if (detailsId && mQuery('#timeline-details-' + detailsId).length) {
            var activateDetailsState = mQuery(this).hasClass('active');
            if (activateDetailsState) {
                mQuery('#timeline-details-' + detailsId).addClass('hide');
                mQuery(this).removeClass('active');
            } else {
                mQuery('#timeline-details-' + detailsId).removeClass('hide');
                mQuery(this).addClass('active');
            }
        }
    });
    if (response && typeof response.timelineCount != 'undefined') {
        mQuery('#TimelineCount').html(response.timelineCount);
    }
};
Mautic.leadAuditlogOnLoad = function(container, response) {
    mQuery("#contact-auditlog a[data-activate-details='all']").on('click', function() {
        if (mQuery(this).find('span').first().hasClass('fa-level-down')) {
            mQuery("#contact-auditlog a[data-activate-details!='all']").each(function() {
                var detailsId = mQuery(this).data('activate-details');
                if (detailsId && mQuery('#auditlog-details-' + detailsId).length) {
                    mQuery('#auditlog-details-' + detailsId).removeClass('hide');
                    mQuery(this).addClass('active');
                }
            });
            mQuery(this).find('span').first().removeClass('fa-level-down').addClass('fa-level-up');
        } else {
            mQuery("#contact-auditlog a[data-activate-details!='all']").each(function() {
                var detailsId = mQuery(this).data('activate-details');
                if (detailsId && mQuery('#auditlog-details-' + detailsId).length) {
                    mQuery('#auditlog-details-' + detailsId).addClass('hide');
                    mQuery(this).removeClass('active');
                }
            });
            mQuery(this).find('span').first().removeClass('fa-level-up').addClass('fa-level-down');
        }
    });
    mQuery("#contact-auditlog a[data-activate-details!='all']").on('click', function() {
        var detailsId = mQuery(this).data('activate-details');
        if (detailsId && mQuery('#auditlog-details-' + detailsId).length) {
            var activateDetailsState = mQuery(this).hasClass('active');
            if (activateDetailsState) {
                mQuery('#auditlog-details-' + detailsId).addClass('hide');
                mQuery(this).removeClass('active');
            } else {
                mQuery('#auditlog-details-' + detailsId).removeClass('hide');
                mQuery(this).addClass('active');
            }
        }
    });
};
Mautic.leadOnUnload = function(id) {
    if (typeof MauticVars.moderatedIntervals['leadListLiveUpdate'] != 'undefined') {
        Mautic.clearModeratedInterval('leadListLiveUpdate');
    }
    if (typeof Mautic.mapObjects !== 'undefined') {
        delete Mautic.mapObjects;
    }
};
Mautic.getLeadId = function() {
    return mQuery('input#leadId').val();
}
Mautic.leadEmailOnLoad = function(container, response) {
    mQuery('[name="lead_quickemail"]').on('submit.ajaxform', function() {
        var emailHtml = mQuery('.fr-iframe').contents();
        var textarea = mQuery(this).find('#lead_quickemail_body');
        mQuery.each(emailHtml.find('td, th, table'), function() {
            var td = mQuery(this);
            if (td.attr('fr-original-class')) {
                td.attr('class', td.attr('fr-original-class'));
                td.removeAttr('fr-original-class');
            }
            if (td.attr('fr-original-style')) {
                td.attr('style', td.attr('fr-original-style'));
                td.removeAttr('fr-original-style');
            }
            if (td.css('border') === '1px solid rgb(221, 221, 221)') {
                td.css('border', '');
            }
        });
        emailHtml.find('body').removeAttr('contenteditable');
        emailHtml.find('body').css('overflow', 'initial');
        var styleElement = emailHtml.find('style[data-fr-style]');
        var style = styleElement.text();
        style = style.replace(/overflow:\s*hidden\s*;\s*/, '');
        styleElement.get(0).innerHTML = style;
        textarea.val(emailHtml.find('html').get(0).outerHTML);
    });
}
Mautic.leadlistOnLoad = function(container, response) {
    mQuery('#campaign-share-tab').hover(function() {
        if (Mautic.shareTableLoaded != true) {
            Mautic.loadAjaxColumn('campaign-share-stat', 'lead:getCampaignShareStats', 'afterStatsLoad');
            Mautic.shareTableLoaded = true;
        }
    })
    Mautic.afterStatsLoad = function() {
        Mautic.sortTableByColumn('#campaign-share-table', '.campaign-share-stat', true)
    }
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'lead.list');
    }
    var prefix = 'leadlist';
    var parent = mQuery('.dynamic-content-filter, .dwc-filter');
    if (parent.length) {
        prefix = parent.attr('id');
    }
    if (mQuery('#' + prefix + '_filters').length) {
        mQuery('#available_filters').on('change', function() {
            if (mQuery(this).val()) {
                Mautic.addLeadListFilter(mQuery(this).val(), mQuery('option:selected', this).data('field-object'));
                mQuery(this).val('');
                mQuery(this).trigger('chosen:updated');
            }
        });
        mQuery('#' + prefix + '_filters .remove-selected').each(function(index, el) {
            mQuery(el).on('click', function() {
                mQuery(this).closest('.panel').animate({
                    'opacity': 0
                }, 'fast', function() {
                    mQuery(this).remove();
                    Mautic.reorderSegmentFilters();
                });
                if (!mQuery('#' + prefix + '_filters li:not(.placeholder)').length) {
                    mQuery('#' + prefix + '_filters li.placeholder').removeClass('hide');
                } else {
                    mQuery('#' + prefix + '_filters li.placeholder').addClass('hide');
                }
            });
        });
        var bodyOverflow = {};
        mQuery('#' + prefix + '_filters').sortable({
            items: '.panel',
            helper: function(e, ui) {
                ui.children().each(function() {
                    if (mQuery(this).is(":visible")) {
                        mQuery(this).width(mQuery(this).width());
                    }
                });
                bodyOverflow.overflowX = mQuery('body').css('overflow-x');
                bodyOverflow.overflowY = mQuery('body').css('overflow-y');
                mQuery('body').css({
                    overflowX: 'visible',
                    overflowY: 'visible'
                });
                return ui;
            },
            scroll: true,
            axis: 'y',
            stop: function(e, ui) {
                mQuery('body').css(bodyOverflow);
                ui.item.find('select.glue-select').first().val('and');
                Mautic.reorderSegmentFilters();
            }
        });
    }
    var segmentContactForm = mQuery('#segment-contact-filters');
    if (segmentContactForm.length) {
        segmentContactForm.on('change', function() {
            segmentContactForm.submit();
        }).on('keyup', function() {
            segmentContactForm.delay(200).submit();
        }).on('submit', function(e) {
            e.preventDefault();
            Mautic.refreshSegmentContacts(segmentContactForm);
        });
    }
};
Mautic.reorderSegmentFilters = function() {
    var counter = 0;
    var prefix = 'leadlist';
    var parent = mQuery('.dynamic-content-filter, .dwc-filter');
    if (parent.length) {
        prefix = parent.attr('id');
    }
    mQuery('#' + prefix + '_filters .panel').each(function() {
        Mautic.updateFilterPositioning(mQuery(this).find('select.glue-select').first());
        mQuery(this).find('[id^="' + prefix + '_filters_"]').each(function() {
            var id = mQuery(this).attr('id');
            var name = mQuery(this).attr('name');
            var suffix = id.split(/[_]+/).pop();
            if (prefix + '_filters___name___filter' === id) {
                return true;
            }
            var newName = prefix + '[filters][' + counter + '][' + suffix + ']';
            if (typeof name !== 'undefined' && name.slice(-2) === '[]') {
                newName += '[]';
            }
            mQuery(this).attr('name', newName);
            mQuery(this).attr('id', prefix + '_filters_' + counter + '_' + suffix);
            if (mQuery(this).is('select') && suffix == "filter") {
                Mautic.destroyChosen(mQuery(this));
                Mautic.activateChosenSelect(mQuery(this));
            }
        });
        ++counter;
    });
    mQuery('#' + prefix + '_filters .panel-heading').removeClass('hide');
    mQuery('#' + prefix + '_filters .panel-heading').first().addClass('hide');
};
Mautic.convertLeadFilterInput = function(el) {
    var prefix = 'leadlist';
    var parent = mQuery(el).parents('.dynamic-content-filter, .dwc-filter');
    if (parent.length) {
        prefix = parent.attr('id');
    }
    var operator = mQuery(el).val();
    var regExp = /_filters_(\d+)_operator/;
    var matches = regExp.exec(mQuery(el).attr('id'));
    var filterNum = matches[1];
    var filterId = '#' + prefix + '_filters_' + filterNum + '_filter';
    if (mQuery(filterId).parent().hasClass('has-error')) {
        mQuery(filterId).parent().find('div.help-block').hide();
        mQuery(filterId).parent().removeClass('has-error');
    }
    var disabled = (operator == 'empty' || operator == '!empty');
    mQuery(filterId + ', #' + prefix + '_filters_' + filterNum + '_display').prop('disabled', disabled);
    if (disabled) {
        mQuery(filterId).val('');
    }
    var newName = '';
    var lastPos;
    if (mQuery(filterId).is('select')) {
        var isMultiple = mQuery(filterId).attr('multiple');
        var multiple = (operator == 'in' || operator == '!in');
        var placeholder = mQuery(filterId).attr('data-placeholder');
        if (multiple && !isMultiple) {
            mQuery(filterId).attr('multiple', 'multiple');
            newName = mQuery(filterId).attr('name') + '[]';
            mQuery(filterId).attr('name', newName);
            placeholder = mauticLang['chosenChooseMore'];
        } else if (!multiple && isMultiple) {
            mQuery(filterId).removeAttr('multiple');
            newName = mQuery(filterId).attr('name');
            lastPos = newName.lastIndexOf('[]');
            newName = newName.substring(0, lastPos);
            mQuery(filterId).attr('name', newName);
            placeholder = mauticLang['chosenChooseOne'];
        }
        if (multiple) {
            mQuery(filterId).find('option[value=""]').remove();
            mQuery(filterId + ' option:selected').removeAttr('selected');
        } else {
            mQuery(filterId).prepend("<option value='' selected></option>");
        }
        Mautic.destroyChosen(mQuery(filterId));
        mQuery(filterId).attr('data-placeholder', placeholder);
        Mautic.activateChosenSelect(mQuery(filterId));
    }
};
Mautic.updateLookupListFilter = function(field, datum) {
    if (datum && datum.id) {
        var filterField = '#' + field.replace('_display', '_filter');
        mQuery(filterField).val(datum.id);
    }
};
Mautic.activateSegmentFilterTypeahead = function(displayId, filterId, fieldOptions, mQueryObject) {
    var mQueryBackup = mQuery;
    if (typeof mQueryObject == 'function') {
        mQuery = mQueryObject;
    }
    mQuery('#' + displayId).attr('data-lookup-callback', 'updateLookupListFilter');
    Mautic.activateFieldTypeahead(displayId, filterId, [], 'lead:fieldList')
    mQuery = mQueryBackup;
};
Mautic.addLeadListFilter = function(elId, elObj) {
    var filterId = '#available_' + elObj + '_' + elId;
    var filterOption = mQuery(filterId);
    var label = filterOption.text();
    var alias = filterOption.val();
    var filterNum = parseInt(mQuery('.available-filters').data('index'));
    mQuery('.available-filters').data('index', filterNum + 1);
    var prototypeStr = mQuery('.available-filters').data('prototype');
    var fieldType = filterOption.data('field-type');
    var fieldObject = filterOption.data('field-object');
    var isSpecial = (mQuery.inArray(fieldType, ['leadlist', 'campaign', 'assets', 'device_type', 'device_brand', 'device_os', 'lead_email_received', 'lead_email_sent', 'tags', 'multiselect', 'boolean', 'select', 'country', 'timezone', 'region', 'stage', 'locale', 'globalcategory']) != -1);
    prototypeStr = prototypeStr.replace(/__name__/g, filterNum);
    prototypeStr = prototypeStr.replace(/__label__/g, label);
    prototype = mQuery(prototypeStr);
    var prefix = 'leadlist';
    var parent = mQuery(filterId).parents('.dynamic-content-filter, .dwc-filter');
    if (parent.length) {
        prefix = parent.attr('id');
    }
    var filterBase = prefix + "[filters][" + filterNum + "]";
    var filterIdBase = prefix + "_filters_" + filterNum + "_";
    if (isSpecial) {
        var templateField = fieldType;
        if (fieldType == 'boolean' || fieldType == 'multiselect') {
            templateField = 'select';
        }
        var template = mQuery('#templates .' + templateField + '-template').clone();
        template.attr('name', mQuery(template).attr('name').replace(/__name__/g, filterNum));
        template.attr('id', mQuery(template).attr('id').replace(/__name__/g, filterNum));
        prototype.find('input[name="' + filterBase + '[filter]"]').replaceWith(template);
    }
    if (mQuery('#' + prefix + '_filters div.panel').length == 0) {
        prototype.find(".panel-heading").addClass('hide');
    }
    if (fieldObject == 'company') {
        prototype.find(".object-icon").removeClass('fa-user').addClass('fa-building');
    } else {
        prototype.find(".object-icon").removeClass('fa-building').addClass('fa-user');
    }
    prototype.find(".inline-spacer").append(fieldObject);
    prototype.find("a.remove-selected").on('click', function() {
        mQuery(this).closest('.panel').animate({
            'opacity': 0
        }, 'fast', function() {
            mQuery(this).remove();
            Mautic.reorderSegmentFilters();
        });
    });
    prototype.find("input[name='" + filterBase + "[field]']").val(elId);
    prototype.find("input[name='" + filterBase + "[type]']").val(fieldType);
    prototype.find("input[name='" + filterBase + "[object]']").val(fieldObject);
    var filterEl = (isSpecial) ? "select[name='" + filterBase + "[filter]']" : "input[name='" + filterBase + "[filter]']";
    prototype.appendTo('#' + prefix + '_filters');
    var filter = mQuery('#' + filterIdBase + 'filter');
    if (isSpecial) {
        if (fieldType == 'select' || fieldType == 'multiselect' || fieldType == 'boolean') {
            var fieldOptions = filterOption.data("field-list");
            mQuery.each(fieldOptions, function(index, val) {
                if (mQuery.isPlainObject(val)) {
                    var optGroup = index;
                    mQuery.each(val, function(index, value) {
                        mQuery('<option class="' + optGroup + '">').val(index).text(value).appendTo(filterEl);
                    });
                    mQuery('.' + index).wrapAll("<optgroup label='" + index + "' />");
                } else {
                    mQuery('<option>').val(index).text(val).appendTo(filterEl);
                }
            });
        }
    } else if (fieldType == 'lookup') {
        var fieldCallback = filterOption.data("field-callback");
        if (fieldCallback && typeof Mautic[fieldCallback] == 'function') {
            var fieldOptions = filterOption.data("field-list");
            Mautic[fieldCallback](filterIdBase + 'filter', elId, fieldOptions);
        } else {
            filter.attr('data-target', alias);
            Mautic.activateLookupTypeahead(filter.parent());
        }
    } else if (fieldType == 'datetime') {
        filter.datetimepicker({
            format: 'Y-m-d H:i',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false
        });
    } else if (fieldType == 'date') {
        filter.datetimepicker({
            timepicker: false,
            format: 'Y-m-d',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false,
            closeOnDateSelect: true
        });
    } else if (fieldType == 'time') {
        filter.datetimepicker({
            datepicker: false,
            format: 'H:i',
            lazyInit: true,
            validateOnBlur: false,
            allowBlank: true,
            scrollMonth: false,
            scrollInput: false
        });
    } else if (fieldType == 'lookup_id') {
        var oldFilter = mQuery(filterEl);
        var newDisplay = oldFilter.clone();
        newDisplay.attr('name', filterBase + '[display]').attr('id', filterIdBase + 'display');
        var oldDisplay = prototype.find("input[name='" + filterBase + "[display]']");
        var newFilter = mQuery(oldDisplay).clone();
        newFilter.attr('name', filterBase + '[filter]');
        newFilter.attr('id', filterIdBase + 'filter');
        oldFilter.replaceWith(newFilter);
        oldDisplay.replaceWith(newDisplay);
        var fieldCallback = filterOption.data("field-callback");
        if (fieldCallback && typeof Mautic[fieldCallback] == 'function') {
            var fieldOptions = filterOption.data("field-list");
            Mautic[fieldCallback](filterIdBase + 'display', elId, fieldOptions);
        }
    } else {
        filter.attr('type', fieldType);
    }
    var operators = filterOption.data('field-operators');
    mQuery('#' + filterIdBase + 'operator').html('');
    mQuery.each(operators, function(label, value) {
        var newOption = mQuery('<option/>').val(value).text(label);
        newOption.appendTo(mQuery('#' + filterIdBase + 'operator'));
    });
    Mautic.convertLeadFilterInput('#' + filterIdBase + 'operator');
    Mautic.updateFilterPositioning(mQuery('#' + filterIdBase + 'glue'));
};
Mautic.leadfieldOnLoad = function(container) {
    if (mQuery(container + ' .leadfield-list').length) {
        var bodyOverflow = {};
        mQuery(container + ' .leadfield-list tbody').sortable({
            handle: '.fa-ellipsis-v',
            helper: function(e, ui) {
                ui.children().each(function() {
                    mQuery(this).width(mQuery(this).width());
                });
                bodyOverflow.overflowX = mQuery('body').css('overflow-x');
                bodyOverflow.overflowY = mQuery('body').css('overflow-y');
                mQuery('body').css({
                    overflowX: 'visible',
                    overflowY: 'visible'
                });
                return ui;
            },
            scroll: false,
            axis: 'y',
            containment: container + ' .leadfield-list',
            stop: function(e, ui) {
                mQuery('body').css(bodyOverflow);
                mQuery.ajax({
                    type: "POST",
                    url: mauticAjaxUrl + "?action=lead:reorder&limit=" + mQuery('.pagination-limit').val() + '&page=' + mQuery('.pagination li.active a span').first().text(),
                    data: mQuery(container + ' .leadfield-list tbody').sortable("serialize")
                });
            }
        });
    }
    if (mQuery(container + ' form[name="leadfield"]').length) {
        Mautic.updateLeadFieldProperties(mQuery('#leadfield_type').val(), true);
    }
};
Mautic.updateLeadFieldProperties = function(selectedVal, onload) {
    if (selectedVal == 'multiselect') {
        selectedVal = 'select';
    }
    if (mQuery('#field-templates .' + selectedVal).length) {
        mQuery('#leadfield_properties').html(mQuery('#field-templates .' + selectedVal).html().replace(/leadfield_properties_template/g, 'leadfield_properties'));
        mQuery("#leadfield_properties *[data-toggle='sortablelist']").each(function(index) {
            var sortableList = mQuery(this);
            Mautic.activateSortable(this);
            var contactFieldListOptions = mQuery('#leadfield_properties').find('input').map(function() {
                return mQuery(this).val();
            }).get().join();
            var updateDefaultValuesetInterval = setInterval(function() {
                var evalListOptions = mQuery('#leadfield_properties').find('input').map(function() {
                    return mQuery(this).val();
                }).get().join();
                if (mQuery('#leadfield_properties_itemcount').length) {
                    if (contactFieldListOptions != evalListOptions) {
                        contactFieldListOptions = evalListOptions;
                        var selected = mQuery('#leadfield_defaultValue').val();
                        mQuery('#leadfield_defaultValue').html('<option value=""></option>');
                        var labels = mQuery('#leadfield_properties').find('input.sortable-label');
                        if (labels.length) {
                            labels.each(function() {
                                var label = mQuery(this).val();
                                var val = mQuery(this).closest('.row').find('input.sortable-value').first().val();
                                mQuery('<option value="' + val + '">' + label + '</option>').appendTo(mQuery('#leadfield_defaultValue'));
                            });
                        } else {
                            mQuery('#leadfield_properties .list-sortable').find('input').each(function() {
                                var val = mQuery(this).val();
                                mQuery('<option value="' + val + '">' + val + '</option>').appendTo(mQuery('#leadfield_defaultValue'));
                            });
                        }
                        mQuery('#leadfield_defaultValue').val(selected);
                        mQuery('#leadfield_defaultValue').trigger('chosen:updated');
                    }
                } else {
                    clearInterval(updateDefaultValuesetInterval);
                    delete contactFieldListOptions;
                }
            }, 500);
        });
    } else if (!mQuery('#leadfield_properties .' + selectedVal).length) {
        mQuery('#leadfield_properties').html('');
    }
    if (selectedVal == 'time') {
        mQuery('#leadfield_isListable').closest('.row').addClass('hide');
    } else {
        mQuery('#leadfield_isListable').closest('.row').removeClass('hide');
    }
    var defaultValueField = mQuery('#leadfield_defaultValue');
    if (defaultValueField.hasClass('calendar-activated')) {
        defaultValueField.datetimepicker('destroy').removeClass('calendar-activated');
    } else if (mQuery('#leadfield_defaultValue_chosen').length) {
        Mautic.destroyChosen(defaultValueField);
    }
    var defaultFieldType = mQuery('input[name="leadfield[defaultValue]"]').attr('type');
    var tempType = selectedVal;
    var html = '';
    var isSelect = false;
    var defaultVal = defaultValueField.val();
    switch (selectedVal) {
        case 'boolean':
            if (defaultFieldType != 'radio') {
                html = '<div id="leadfield_default_template_boolean">' + mQuery('#field-templates .default_template_boolean').html() + '</div>';
            }
            break;
        case 'country':
        case 'region':
        case 'locale':
        case 'timezone':
            html = mQuery('#field-templates .default_template_' + selectedVal).html();
            isSelect = true;
            break;
        case 'select':
        case 'multiselect':
        case 'lookup':
            html = mQuery('#field-templates .default_template_select').html();
            tempType = 'select';
            isSelect = true;
            break;
        case 'textarea':
            html = mQuery('#field-templates .default_template_textarea').html();
            break;
        default:
            html = mQuery('#field-templates .default_template_text').html();
            tempType = 'text';
            if (selectedVal == 'number' || selectedVal == 'tel' || selectedVal == 'url' || selectedVal == 'email') {
                var replace = 'type="text"';
                var regex = new RegExp(replace, "g");
                html = html.replace(regex, 'type="' + selectedVal + '"');
            }
            break;
    }
    if (html && !onload) {
        var replace = 'default_template_' + tempType;
        var regex = new RegExp(replace, "g");
        html = html.replace(regex, 'defaultValue')
        defaultValueField.replaceWith(mQuery(html));
        mQuery('#leadfield_defaultValue').val(defaultVal);
    }
    if (selectedVal === 'datetime' || selectedVal === 'date' || selectedVal === 'time') {
        Mautic.activateDateTimeInputs('#leadfield_defaultValue', selectedVal);
    } else if (isSelect) {
        Mautic.activateChosenSelect('#leadfield_defaultValue');
    }
};
Mautic.updateLeadFieldBooleanLabels = function(el, label) {
    mQuery('#leadfield_defaultValue_' + label).parent().find('span').text(mQuery(el).val());
};
Mautic.refreshLeadSocialProfile = function(network, leadId, event) {
    var query = "action=lead:updateSocialProfile&network=" + network + "&lead=" + leadId;
    mQuery.ajax({
        showLoadingBar: true,
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            if (response.success) {
                if (response.completeProfile) {
                    mQuery('#social-container').html(response.completeProfile);
                    mQuery('#SocialCount').html(response.socialCount);
                } else {
                    mQuery.each(response.profiles, function(index, value) {
                        if (mQuery('#' + index + 'CompleteProfile').length) {
                            mQuery('#' + index + 'CompleteProfile').html(value.newContent);
                        }
                    });
                }
            }
            Mautic.stopPageLoadingBar();
            Mautic.stopIconSpinPostEvent();
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        }
    });
};
Mautic.clearLeadSocialProfile = function(network, leadId, event) {
    Mautic.startIconSpinOnEvent(event);
    var query = "action=lead:clearSocialProfile&network=" + network + "&lead=" + leadId;
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            if (response.success) {
                mQuery('.' + network + '-panelremove').click();
                if (response.completeProfile) {
                    mQuery('#social-container').html(response.completeProfile);
                }
                mQuery('#SocialCount').html(response.socialCount);
            }
            Mautic.stopIconSpinPostEvent();
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
            Mautic.stopIconSpinPostEvent();
        }
    });
};
Mautic.refreshLeadAuditLog = function(form) {
    Mautic.postForm(mQuery(form), function(response) {
        response.target = '#auditlog-table';
        mQuery('#AuditLogCount').html(response.auditLogCount);
        Mautic.processPageContent(response);
    });
};
Mautic.refreshLeadTimeline = function(form) {
    Mautic.postForm(mQuery(form), function(response) {
        response.target = '#timeline-table';
        mQuery('#TimelineCount').html(response.timelineCount);
        Mautic.processPageContent(response);
    });
};
Mautic.refreshLeadNotes = function(form) {
    Mautic.postForm(mQuery(form), function(response) {
        response.target = '#NoteList';
        mQuery('#NoteCount').html(response.noteCount);
        Mautic.processPageContent(response);
    });
};
Mautic.refreshSegmentContacts = function(form) {
    Mautic.postForm(mQuery(form), function(response) {
        response.target = '#contacts-container';
        Mautic.processPageContent(response);
    });
};
Mautic.toggleLeadList = function(toggleId, leadId, listId) {
    var action = mQuery('#' + toggleId).hasClass('fa-toggle-on') ? 'remove' : 'add';
    var query = "action=lead:toggleLeadList&leadId=" + leadId + "&listId=" + listId + "&listAction=" + action;
    Mautic.toggleLeadSwitch(toggleId, query, action);
};
Mautic.togglePreferredChannel = function(channel) {
    if (channel === 'all') {
        var channelsForm = mQuery('form[name="contact_channels"]');
        var status = channelsForm.find('#contact_channels_subscribed_channels_0:checked').length;
        channelsForm.find('tbody input:checkbox').each(function() {
            if (this.checked != status) {
                this.checked = status;
                Mautic.setPreferredChannel(this.value);
            }
        });
    } else {
        Mautic.setPreferredChannel(channel);
    }
};
Mautic.setPreferredChannel = function(channel) {
    mQuery('#frequency_' + channel).slideToggle();
    mQuery('#frequency_' + channel).removeClass('hide');
    if (mQuery('#' + channel)[0].checked) {
        mQuery('#is-contactable-' + channel).removeClass('text-muted');
        mQuery('#lead_contact_frequency_rules_frequency_number_' + channel).prop("disabled", false).trigger("chosen:updated");
        mQuery('#preferred_' + channel).prop("disabled", false);
        mQuery('#lead_contact_frequency_rules_frequency_time_' + channel).prop("disabled", false).trigger("chosen:updated");
        mQuery('#lead_contact_frequency_rules_contact_pause_start_date_' + channel).prop("disabled", false);
        mQuery('#lead_contact_frequency_rules_contact_pause_end_date_' + channel).prop("disabled", false);
    } else {
        mQuery('#is-contactable-' + channel).addClass('text-muted');
        mQuery('#lead_contact_frequency_rules_frequency_number_' + channel).prop("disabled", true).trigger("chosen:updated");
        mQuery('#preferred_' + channel).prop("disabled", true);
        mQuery('#lead_contact_frequency_rules_frequency_time_' + channel).prop("disabled", true).trigger("chosen:updated");
        mQuery('#lead_contact_frequency_rules_contact_pause_start_date_' + channel).prop("disabled", true);
        mQuery('#lead_contact_frequency_rules_contact_pause_end_date_' + channel).prop("disabled", true);
    }
};
Mautic.toggleCompanyLead = function(toggleId, leadId, companyId) {
    var action = mQuery('#' + toggleId).hasClass('fa-toggle-on') ? 'remove' : 'add';
    var query = "action=lead:toggleCompanyLead&leadId=" + leadId + "&companyId=" + companyId + "&companyAction=" + action;
    Mautic.toggleLeadSwitch(toggleId, query, action);
};
Mautic.toggleLeadCampaign = function(toggleId, leadId, campaignId) {
    var action = mQuery('#' + toggleId).hasClass('fa-toggle-on') ? 'remove' : 'add';
    var query = "action=lead:toggleLeadCampaign&leadId=" + leadId + "&campaignId=" + campaignId + "&campaignAction=" + action;
    Mautic.toggleLeadSwitch(toggleId, query, action);
};
Mautic.toggleLeadSwitch = function(toggleId, query, action) {
    var toggleOn = 'fa-toggle-on text-success';
    var toggleOff = 'fa-toggle-off text-danger';
    var spinClass = 'fa-spin fa-spinner ';
    if (action == 'remove') {
        mQuery('#' + toggleId).removeClass(toggleOn).addClass(spinClass + 'text-danger');
    } else {
        mQuery('#' + toggleId).removeClass(toggleOff).addClass(spinClass + 'text-success');
    }
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            mQuery('#' + toggleId).removeClass(spinClass);
            if (!response.success) {
                if (action == 'remove') {
                    mQuery('#' + toggleId).removeClass(toggleOff).addClass(toggleOn);
                } else {
                    mQuery('#' + toggleId).removeClass(toggleOn).addClass(toggleOff);
                }
            } else {
                if (action == 'remove') {
                    mQuery('#' + toggleId).removeClass(toggleOn).addClass(toggleOff);
                } else {
                    mQuery('#' + toggleId).removeClass(toggleOff).addClass(toggleOn);
                }
            }
        },
        error: function(request, textStatus, errorThrown) {
            mQuery('#' + toggleId).removeClass(spinClass);
            if (action == 'remove') {
                mQuery('#' + toggleId).removeClass(toggleOff).addClass(toggleOn);
            } else {
                mQuery('#' + toggleId).removeClass(toggleOn).addClass(toggleOff);
            }
        }
    });
};
Mautic.leadNoteOnLoad = function(container, response) {
    if (response.noteHtml) {
        var el = '#LeadNote' + response.noteId;
        if (mQuery(el).length) {
            mQuery(el).replaceWith(response.noteHtml);
        } else {
            mQuery('#LeadNotes').prepend(response.noteHtml);
        }
        Mautic.makeModalsAlive(mQuery(el + " *[data-toggle='ajaxmodal']"));
        Mautic.makeConfirmationsAlive(mQuery(el + ' a[data-toggle="confirmation"]'));
        Mautic.makeLinksAlive(mQuery(el + " a[data-toggle='ajax']"));
    } else if (response.deleteId && mQuery('#LeadNote' + response.deleteId).length) {
        mQuery('#LeadNote' + response.deleteId).remove();
    }
    if (response.upNoteCount || response.noteCount || response.downNoteCount) {
        var noteCountWrapper = mQuery('#NoteCount');
        var count = parseInt(noteCountWrapper.text().trim());
        if (response.upNoteCount) {
            count++;
        } else if (response.downNoteCount) {
            count--;
        } else {
            count = parseInt(response.noteCount);
        }
        noteCountWrapper.text(count);
    }
};
Mautic.showSocialMediaImageModal = function(imgSrc) {
    mQuery('#socialImageModal img').attr('src', imgSrc);
    mQuery('#socialImageModal').modal('show');
};
Mautic.leadImportOnLoad = function(container, response) {
    if (!mQuery('#leadImportProgress').length) {
        Mautic.clearModeratedInterval('leadImportProgress');
    } else {
        Mautic.setModeratedInterval('leadImportProgress', 'reloadLeadImportProgress', 3000);
    }
};
Mautic.reloadLeadImportProgress = function() {
    if (!mQuery('#leadImportProgress').length) {
        Mautic.clearModeratedInterval('leadImportProgress');
    } else {
        Mautic.ajaxActionRequest('lead:getImportProgress', {}, function(response) {
            if (response.progress) {
                if (response.progress[0] > 0) {
                    mQuery('.imported-count').html(response.progress[0]);
                    mQuery('.progress-bar-import').attr('aria-valuenow', response.progress[0]).css('width', response.percent + '%');
                    mQuery('.progress-bar-import span.sr-only').html(response.percent + '%');
                }
            }
        });
        mQuery.ajax({
            showLoadingBar: false,
            url: window.location + '?importbatch=1',
            success: function(response) {
                Mautic.moderatedIntervalCallbackIsComplete('leadImportProgress');
                if (response.newContent) {
                    Mautic.processPageContent(response);
                }
            }
        });
    }
};
Mautic.removeBounceStatus = function(el, dncId) {
    mQuery(el).removeClass('fa-times').addClass('fa-spinner fa-spin');
    Mautic.ajaxActionRequest('lead:removeBounceStatus', 'id=' + dncId, function() {
        mQuery('#bounceLabel' + dncId).tooltip('destroy');
        mQuery('#bounceLabel' + dncId).fadeOut(300, function() {
            mQuery(this).remove();
        });
    });
};
Mautic.toggleLiveLeadListUpdate = function() {
    if (typeof MauticVars.moderatedIntervals['leadListLiveUpdate'] == 'undefined') {
        Mautic.setModeratedInterval('leadListLiveUpdate', 'updateLeadList', 5000);
        mQuery('#liveModeButton').addClass('btn-primary');
    } else {
        Mautic.clearModeratedInterval('leadListLiveUpdate');
        mQuery('#liveModeButton').removeClass('btn-primary');
    }
};
Mautic.updateLeadList = function() {
    var maxLeadId = mQuery('#liveModeButton').data('max-id');
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "get",
        data: "action=lead:getNewLeads&maxId=" + maxLeadId,
        dataType: "json",
        success: function(response) {
            if (response.leads) {
                if (response.indexMode == 'list') {
                    mQuery('#leadTable tbody').prepend(response.leads);
                } else {
                    if (mQuery('.shuffle-grid').length) {
                        var Shuffle = window.Shuffle,
                            element = document.querySelector('.shuffle-grid'),
                            shuffleOptions = {
                                itemSelector: '.shuffle-item'
                            };
                        window.leadsShuffleInstance = new Shuffle(element, shuffleOptions);
                        var items = mQuery(response.leads);
                        mQuery('.shuffle-grid').prepend(items);
                        window.leadsShuffleInstance.shuffle('appended', items.children(shuffleOptions.itemSelector).toArray());
                        window.leadsShuffleInstance.shuffle('update');
                    }
                    mQuery('#liveModeButton').data('max-id', response.maxId);
                }
            }
            if (typeof IdleTimer != 'undefined' && !IdleTimer.isIdle()) {
                if (response.indexMode == 'list') {
                    mQuery('#leadTable tr.warning').each(function() {
                        var that = this;
                        setTimeout(function() {
                            mQuery(that).removeClass('warning', 1000)
                        }, 5000);
                    });
                } else {
                    mQuery('.shuffle-grid .highlight').each(function() {
                        var that = this;
                        setTimeout(function() {
                            mQuery(that).removeClass('highlight', 1000, function() {
                                mQuery(that).css('border-top-color', mQuery(that).data('color'));
                            })
                        }, 5000);
                    });
                }
            }
            if (response.maxId) {
                mQuery('#liveModeButton').data('max-id', response.maxId);
            }
            Mautic.moderatedIntervalCallbackIsComplete('leadListLiveUpdate');
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
            Mautic.moderatedIntervalCallbackIsComplete('leadListLiveUpdate');
        }
    });
};
Mautic.toggleAnonymousLeads = function() {
    var searchValue = mQuery('#list-search').typeahead('val');
    var string = mQuery('#anonymousLeadButton').data('anonymous').toLowerCase();
    if (searchValue.toLowerCase().indexOf('!' + string) == 0) {
        searchValue = searchValue.replace('!' + string, string);
        mQuery('#anonymousLeadButton').addClass('btn-primary');
    } else if (searchValue.toLowerCase().indexOf(string) == -1) {
        if (searchValue) {
            searchValue = searchValue + ' ' + string;
        } else {
            searchValue = string;
        }
        mQuery('#anonymousLeadButton').addClass('btn-primary');
    } else {
        searchValue = mQuery.trim(searchValue.replace(string, ''));
        mQuery('#anonymousLeadButton').removeClass('btn-primary');
    }
    searchValue = searchValue.replace("  ", " ");
    Mautic.setSearchFilter(null, 'list-search', searchValue);
};
Mautic.getLeadEmailContent = function(el) {
    var id = (mQuery.type(el) === "string") ? el : mQuery(el).attr('id');
    Mautic.activateLabelLoadingIndicator(id);
    var inModal = mQuery('#' + id).closest('modal').length;
    if (inModal) {
        mQuery('#MauticSharedModal .btn-primary').prop('disabled', true);
    }
    Mautic.ajaxActionRequest('lead:getEmailTemplate', {
        'template': mQuery(el).val()
    }, function(response) {
        if (inModal) {
            mQuery('#MauticSharedModal .btn-primary').prop('disabled', false);
        }
        var idPrefix = id.replace('templates', '');
        var bodyEl = (mQuery('#' + idPrefix + 'message').length) ? '#' + idPrefix + 'message' : '#' + idPrefix + 'body';
        mQuery(bodyEl).froalaEditor('html.set', response.body);
        mQuery(bodyEl).val(response.body);
        mQuery('#' + idPrefix + 'subject').val(response.subject);
        Mautic.removeLabelLoadingIndicator();
    });
};
Mautic.updateLeadTags = function() {
    Mautic.activateLabelLoadingIndicator('lead_tags_tags');
    var formData = mQuery('form[name="lead_tags"]').serialize();
    Mautic.ajaxActionRequest('lead:updateLeadTags', formData, function(response) {
        if (response.tags) {
            mQuery('#lead_tags_tags').html(response.tags);
            mQuery('#lead_tags_tags').trigger('chosen:updated');
        }
        Mautic.removeLabelLoadingIndicator();
    });
};
Mautic.createLeadTag = function(el) {
    var newFound = false;
    mQuery('#' + mQuery(el).attr('id') + ' :selected').each(function(i, selected) {
        if (!mQuery.isNumeric(mQuery(selected).val())) {
            newFound = true;
        }
    });
    if (!newFound) {
        return;
    }
    Mautic.activateLabelLoadingIndicator(mQuery(el).attr('id'));
    var tags = JSON.stringify(mQuery(el).val());
    Mautic.ajaxActionRequest('lead:addLeadTags', {
        tags: tags
    }, function(response) {
        if (response.tags) {
            mQuery('#' + mQuery(el).attr('id')).html(response.tags);
            mQuery('#' + mQuery(el).attr('id')).trigger('chosen:updated');
        }
        Mautic.removeLabelLoadingIndicator();
    });
};
Mautic.createLeadUtmTag = function(el) {
    var newFound = false;
    mQuery('#' + mQuery(el).attr('id') + ' :selected').each(function(i, selected) {
        if (!mQuery.isNumeric(mQuery(selected).val())) {
            newFound = true;
        }
    });
    if (!newFound) {
        return;
    }
    Mautic.activateLabelLoadingIndicator(mQuery(el).attr('id'));
    var utmtags = JSON.stringify(mQuery(el).val());
    Mautic.ajaxActionRequest('lead:addLeadUtmTags', {
        utmtags: utmtags
    }, function(response) {
        if (response.tags) {
            mQuery('#' + mQuery(el).attr('id')).html(response.utmtags);
            mQuery('#' + mQuery(el).attr('id')).trigger('chosen:updated');
        }
        Mautic.removeLabelLoadingIndicator();
    });
};
Mautic.leadBatchSubmit = function() {
    if (Mautic.batchActionPrecheck()) {
        if (mQuery('#lead_batch_remove').val() || mQuery('#lead_batch_add').val() || mQuery('#lead_batch_dnc_reason').length || mQuery('#lead_batch_stage_addstage').length || mQuery('#lead_batch_owner_addowner').length || mQuery('#contact_channels_ids').length) {
            var ids = Mautic.getCheckedListIds(false, true);
            if (mQuery('#lead_batch_ids').length) {
                mQuery('#lead_batch_ids').val(ids);
            } else if (mQuery('#lead_batch_dnc_reason').length) {
                mQuery('#lead_batch_dnc_ids').val(ids);
            } else if (mQuery('#lead_batch_stage_addstage').length) {
                mQuery('#lead_batch_stage_ids').val(ids);
            } else if (mQuery('#lead_batch_owner_addowner').length) {
                mQuery('#lead_batch_owner_ids').val(ids);
            } else if (mQuery('#contact_channels_ids').length) {
                mQuery('#contact_channels_ids').val(ids);
            }
            return true;
        }
    }
    mQuery('#MauticSharedModal').modal('hide');
    return false;
};
Mautic.updateLeadFieldValues = function(field) {
    mQuery('.condition-custom-date-row').hide();
    Mautic.updateFieldOperatorValue(field, 'lead:updateLeadFieldValues', Mautic.updateLeadFieldValueOptions, [true]);
};
Mautic.updateLeadFieldValueOptions = function(field, updating) {
    var fieldId = mQuery(field).attr('id');
    var fieldPrefix = fieldId.slice(0, -5);
    if ('date' === mQuery('#' + fieldPrefix + 'operator').val()) {
        var customOption = mQuery(field).find('option[data-custom=1]');
        var value = mQuery(field).val();
        var customSelected = mQuery(customOption).prop('selected');
        if (customSelected) {
            if (!updating) {
                var regex = /(\+|-)(PT?)([0-9]*)([DMHY])$/g;
                var match = regex.exec(value);
                if (match) {
                    var interval = ('-' === match[1]) ? match[1] + match[3] : match[3];
                    var unit = ('PT' === match[2] && 'M' === match[4]) ? 'i' : match[4];
                    mQuery('#lead-field-custom-date-interval').val(interval);
                    mQuery('#lead-field-custom-date-unit').val(unit.toLowerCase());
                }
            } else {
                var interval = mQuery('#lead-field-custom-date-interval').val();
                var unit = mQuery('#lead-field-custom-date-unit').val();
                var prefix = ("i" == unit || "h" == unit) ? "PT" : "P";
                if ("i" === unit) {
                    unit = "m";
                }
                unit = unit.toUpperCase();
                var operator = "+";
                if (parseInt(interval) < 0) {
                    operator = "-";
                    interval = -1 * parseInt(interval);
                }
                var newValue = operator + prefix + interval + unit;
                customOption.attr('value', newValue);
            }
            mQuery('.condition-custom-date-row').show();
        } else {
            mQuery('.condition-custom-date-row').hide();
        }
    } else {
        mQuery('.condition-custom-date-row').hide();
    }
};
Mautic.toggleTimelineMoreVisiblity = function(el) {
    if (mQuery(el).is(':visible')) {
        mQuery(el).slideUp('fast');
        mQuery(el).next().text(mauticLang['showMore']);
    } else {
        mQuery(el).slideDown('fast');
        mQuery(el).next().text(mauticLang['hideMore']);
    }
};
Mautic.displayUniqueIdentifierWarning = function(el) {
    if (mQuery(el).val() === "0") {
        mQuery('.unique-identifier-warning').fadeOut('fast');
    } else {
        mQuery('.unique-identifier-warning').fadeIn('fast');
    }
};
Mautic.initUniqueIdentifierFields = function() {
    var uniqueFields = mQuery('[data-unique-identifier]');
    if (uniqueFields.length) {
        uniqueFields.on('change', function() {
            var input = mQuery(this);
            var request = {
                field: input.data('unique-identifier'),
                value: input.val(),
                ignore: mQuery('#lead_unlockId').val()
            };
            Mautic.ajaxActionRequest('lead:getLeadIdsByFieldValue', request, function(response) {
                if (response.items !== 'undefined' && response.items.length) {
                    var warning = mQuery('<div class="exists-warning" />').text(response.existsMessage);
                    mQuery.each(response.items, function(i, item) {
                        if (i > 0) {
                            warning.append(mQuery('<span>, </span>'));
                        }
                        var link = mQuery('<a/>').attr('href', item.link).attr('target', '_blank').text(item.name + ' (' + item.id + ')');
                        warning.append(link);
                    });
                    warning.appendTo(input.parent());
                } else {
                    input.parent().find('div.exists-warning').remove();
                }
            });
        });
    }
};
Mautic.updateFilterPositioning = function(el) {
    var $el = mQuery(el);
    var $parentEl = $el.closest('.panel');
    var list = $parentEl.parent().children('.panel');
    if ($el.val() == 'and' && list.index($parentEl) !== 0) {
        $parentEl.addClass('in-group');
    } else {
        $parentEl.removeClass('in-group');
    }
};
Mautic.setAsPrimaryCompany = function(companyId, leadId) {
    Mautic.ajaxActionRequest('lead:setAsPrimaryCompany', {
        'companyId': companyId,
        'leadId': leadId
    }, function(response) {
        if (response.success) {
            if (response.oldPrimary == response.newPrimary && mQuery('#company-' + response.oldPrimary).hasClass('primary')) {
                mQuery('#company-' + response.oldPrimary).removeClass('primary');
            } else {
                mQuery('#company-' + response.oldPrimary).removeClass('primary');
                mQuery('#company-' + response.newPrimary).addClass('primary');
            }
        }
    });
};;
Mautic.notificationOnLoad = function(container, response) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'notification');
    }
    Mautic.activatePreviewPanelUpdate();
};
Mautic.selectNotificationType = function(notificationType) {
    if (notificationType == 'list') {
        mQuery('#leadList').removeClass('hide');
        mQuery('#publishStatus').addClass('hide');
        mQuery('.page-header h3').text(mauticLang.newListNotification);
    } else {
        mQuery('#publishStatus').removeClass('hide');
        mQuery('#leadList').addClass('hide');
        mQuery('.page-header h3').text(mauticLang.newTemplateNotification);
    }
    mQuery('#notification_notificationType').val(notificationType);
    mQuery('body').removeClass('noscroll');
    mQuery('.notification-type-modal').remove();
    mQuery('.notification-type-modal-backdrop').remove();
};
Mautic.standardNotificationUrl = function(options) {
    if (!options) {
        return;
    }
    var url = options.windowUrl;
    if (url) {
        var editEmailKey = '/notifications/edit/notificationId';
        var previewEmailKey = '/notifications/preview/notificationId';
        if (url.indexOf(editEmailKey) > -1 || url.indexOf(previewEmailKey) > -1) {
            options.windowUrl = url.replace('notificationId', mQuery('#campaignevent_properties_notification').val());
        }
    }
    return options;
};
Mautic.disabledNotificationAction = function(opener) {
    if (typeof opener == 'undefined') {
        opener = window;
    }
    var notification = opener.mQuery('#campaignevent_properties_notification').val();
    var disabled = notification === '' || notification === null;
    opener.mQuery('#campaignevent_properties_editNotificationButton').prop('disabled', disabled);
};
Mautic.activatePreviewPanelUpdate = function() {
    var notificationPreview = mQuery('#notification-preview');
    var notificationForm = mQuery('form[name="notification"]');
    if (notificationPreview.length && notificationForm.length) {
        var inputs = notificationForm.find('input,textarea');
        inputs.on('blur', function() {
            var $this = mQuery(this);
            var name = $this.attr('name');
            if (name === 'notification[heading]') {
                notificationPreview.find('h4').text($this.val());
            }
            if (name === 'notification[message]') {
                notificationPreview.find('p').text($this.val());
            }
            if (name === 'notification[url]') {
                notificationPreview.find('span').not('.fa-bell').text($this.val());
            }
        });
    }
};;
Mautic.pageOnLoad = function(container, response) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'page.page');
    }
    if (mQuery(container + ' #page_template').length) {
        Mautic.toggleBuilderButton(mQuery('#page_template').val() == '');
        if (mQuery(container + ' select[name="page[redirectType]"]').length) {
            Mautic.autoHideRedirectUrl(container);
            mQuery(container + ' select[name="page[redirectType]"]').chosen().change(function() {
                Mautic.autoHideRedirectUrl(container);
            });
        }
        Mautic.getTokens(Mautic.getBuilderTokensMethod(), function() {});
        Mautic.initSelectTheme(mQuery('#page_template'));
    }
    if (response && response.inBuilder) {
        Mautic.launchBuilder('page');
        Mautic.processBuilderErrors(response);
    }
};
Mautic.getPageAbTestWinnerForm = function(abKey) {
    if (abKey && mQuery(abKey).val() && mQuery(abKey).closest('.form-group').hasClass('has-error')) {
        mQuery(abKey).closest('.form-group').removeClass('has-error');
        if (mQuery(abKey).next().hasClass('help-block')) {
            mQuery(abKey).next().remove();
        }
    }
    Mautic.activateLabelLoadingIndicator('page_variantSettings_winnerCriteria');
    var pageId = mQuery('#page_sessionId').val();
    var query = "action=page:getAbTestForm&abKey=" + mQuery(abKey).val() + "&pageId=" + pageId;
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            if (typeof response.html != 'undefined') {
                if (mQuery('#page_variantSettings_properties').length) {
                    mQuery('#page_variantSettings_properties').replaceWith(response.html);
                } else {
                    mQuery('#page_variantSettings').append(response.html);
                }
                if (response.html != '') {
                    Mautic.onPageLoad('#page_variantSettings_properties', response);
                }
            }
            Mautic.removeLabelLoadingIndicator();
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
            spinner.remove();
        },
        complete: function() {
            Mautic.removeLabelLoadingIndicator();
        }
    });
};
Mautic.autoHideRedirectUrl = function(container) {
    var select = mQuery(container + ' select[name="page[redirectType]"]');
    var input = mQuery(container + ' input[name="page[redirectUrl]"]');
    if (select.val() == '') {
        input.closest('.form-group').hide();
        input.val('');
    } else {
        input.closest('.form-group').show();
    }
};;
if (typeof MauticPrefCenterLoaded === 'undefined') {
    var MauticPrefCenterLoaded = true;

    function replaceSlotParams(slot) {
        var i;
        var text = slot.dataset['paramLabelText'];
        if (text) {
            setLabelText(slot, 'label.control-label', text);
            var channels = slot.querySelectorAll('label[data-channel]');
            for (i = 0; i < channels.length; i++) {
                channels[i].innerHTML = text.replace('%channel%', channels[i].dataset['channel']);
            }
        }
        var numOfLabelsInSlot = 4;
        for (i = 1; i <= numOfLabelsInSlot; i++) {
            text = slot.dataset['paramLabelText' + i];
            if (typeof text !== "undefined") {
                setLabelText(slot, 'label.label' + i, text);
            }
        }
        text = slot.dataset['paramLinkText'];
        if (typeof text !== "undefined") {
            var labels = slot.querySelectorAll('.button');
            labels[0].innerHTML = text;
        }
    }

    function setLabelText(slot, querySelector, text) {
        var labels = slot.querySelectorAll(querySelector);
        for (var i = 0; i < labels.length; i++) {
            labels[i].innerHTML = text;
        }
    }
    var callback = function() {
        var slots = document.querySelectorAll('div[data-slot="segmentlist"], div[data-slot="categorylist"], div[data-slot="preferredchannel"], div[data-slot="channelfrequency"],div[data-slot="saveprefsbutton"]');
        for (var i = 0; i < slots.length; i++) {
            replaceSlotParams(slots[i]);
        }
    };
    if (document.readyState === "complete" || !(document.readyState === "loading" || document.documentElement.doScroll)) {
        callback();
    } else {
        document.addEventListener("DOMContentLoaded", callback);
    }

    function togglePreferredChannel(channel) {
        var status = document.getElementById(channel).checked;
        if (status) {
            document.getElementById('lead_contact_frequency_rules_frequency_number_' + channel).disabled = false;
            document.getElementById('lead_contact_frequency_rules_frequency_time_' + channel).disabled = false;
            document.getElementById('lead_contact_frequency_rules_contact_pause_start_date_' + channel).disabled = false;
            document.getElementById('lead_contact_frequency_rules_contact_pause_end_date_' + channel).disabled = false;
        } else {
            document.getElementById('lead_contact_frequency_rules_frequency_number_' + channel).disabled = true;
            document.getElementById('lead_contact_frequency_rules_frequency_time_' + channel).disabled = true;
            document.getElementById('lead_contact_frequency_rules_contact_pause_start_date_' + channel).disabled = true;
            document.getElementById('lead_contact_frequency_rules_contact_pause_end_date_' + channel).disabled = true;
        }
    }

    function saveUnsubscribePreferences(formId) {
        var forms = document.getElementsByName(formId);
        for (var i = 0; i < forms.length; i++) {
            if (forms[i].tagName === 'FORM') {
                forms[i].submit();
            }
        }
    }
};
Mautic.matchedFields = function(index, object, integration) {
    var compoundMauticFields = ['mauticContactId', 'mauticContactTimelineLink'];
    if (mQuery('#integration_details_featureSettings_updateDncByDate_0').is(':checked')) {
        compoundMauticFields.push('mauticContactIsContactableByEmail');
    }
    var integrationField = mQuery('#integration_details_featureSettings_' + object + 'Fields_i_' + index).attr('data-value');
    var mauticField = mQuery('#integration_details_featureSettings_' + object + 'Fields_m_' + index + ' option:selected').val();
    if (mQuery('.btn-arrow' + index).parent().attr('data-force-direction') != 1) {
        if (mQuery.inArray(mauticField, compoundMauticFields) >= 0) {
            mQuery('.btn-arrow' + index).removeClass('active');
            mQuery('#integration_details_featureSettings_' + object + 'Fields_update_mautic' + index + '_0').attr('checked', 'checked');
            mQuery('input[name="integration_details[featureSettings][' + object + 'Fields][update_mautic' + index + ']"]').prop('disabled', true).trigger("chosen:updated");
            mQuery('.btn-arrow' + index).addClass('disabled');
        } else {
            mQuery('input[name="integration_details[featureSettings][' + object + 'Fields][update_mautic' + index + ']"]').prop('disabled', false).trigger("chosen:updated");
            mQuery('.btn-arrow' + index).removeClass('disabled');
        }
    }
    if (object == 'lead') {
        var updateMauticField = mQuery('input[name="integration_details[featureSettings][' + object + 'Fields][update_mautic' + index + ']"]:checked').val();
    } else {
        var updateMauticField = mQuery('input[name="integration_details[featureSettings][' + object + 'Fields][update_mautic_company' + index + ']"]:checked').val();
    }
    Mautic.ajaxActionRequest('plugin:matchFields', {
        object: object,
        integration: integration,
        integrationField: integrationField,
        mauticField: mauticField,
        updateMautic: updateMauticField
    }, function(response) {
        var theMessage = (response.success) ? '<i class="fa fa-check-circle text-success"></i>' : '';
        mQuery('#matched-' + index + "-" + object).html(theMessage);
    });
};
Mautic.initiateIntegrationAuthorization = function() {
    mQuery('#integration_details_in_auth').val(1);
    Mautic.postForm(mQuery('form[name="integration_details"]'), 'loadIntegrationAuthWindow');
};
Mautic.loadIntegrationAuthWindow = function(response) {
    if (response.newContent) {
        Mautic.processModalContent(response, '#IntegrationEditModal');
    } else {
        Mautic.stopPageLoadingBar();
        Mautic.stopIconSpinPostEvent();
        mQuery('#integration_details_in_auth').val(0);
        if (response.authUrl) {
            var generator = window.open(response.authUrl, 'integrationauth', 'height=500,width=500');
            if (!generator || generator.closed || typeof generator.closed == 'undefined') {
                alert(mauticLang.popupBlockerMessage);
            }
        }
    }
};
Mautic.refreshIntegrationForm = function() {
    var opener = window.opener;
    if (opener) {
        var form = opener.mQuery('form[name="integration_details"]');
        if (form.length) {
            var action = form.attr('action');
            if (action) {
                opener.Mautic.startModalLoadingBar('#IntegrationEditModal');
                opener.Mautic.loadAjaxModal('#IntegrationEditModal', action);
            }
        }
    }
    window.close()
};
Mautic.integrationOnLoad = function(container, response) {
    if (response && response.name) {
        var integration = '.integration-' + response.name;
        if (response.enabled) {
            mQuery(integration).removeClass('integration-disabled');
        } else {
            mQuery(integration).addClass('integration-disabled');
        }
    } else {
        Mautic.filterIntegrations();
    }
    mQuery('[data-toggle="tooltip"]').tooltip();
};
Mautic.integrationConfigOnLoad = function(container) {
    if (mQuery('.fields-container select.integration-field').length) {
        var selects = mQuery('.fields-container select.integration-field');
        selects.on('change', function() {
            var select = mQuery(this),
                newValue = select.val(),
                previousValue = select.attr('data-value');
            select.attr('data-value', newValue);
            var groupSelects = mQuery(this).closest('.fields-container').find('select.integration-field').not(select);
            if (previousValue) {
                mQuery('option[value="' + previousValue + '"]', groupSelects).each(function() {
                    if (!mQuery(this).closest('select').prop('disabled')) {
                        mQuery(this).prop('disabled', false);
                        mQuery(this).removeAttr('disabled');
                    }
                });
            }
            if (newValue) {
                mQuery('option[value="' + newValue + '"]', groupSelects).each(function() {
                    if (!mQuery(this).closest('select').prop('disabled')) {
                        mQuery(this).prop('disabled', true);
                        mQuery(this).attr('disabled', 'disabled');
                    }
                });
            }
            groupSelects.each(function() {
                mQuery(this).trigger('chosen:updated');
            });
        });
        selects.each(function() {
            if (!mQuery(this).closest('.field-container').hasClass('hide')) {
                mQuery(this).trigger('change');
            }
        });
    }
};
Mautic.filterIntegrations = function(update) {
    var filter = mQuery('#integrationFilter').val();
    if (update) {
        mQuery.ajax({
            url: mauticAjaxUrl,
            type: "POST",
            data: "action=plugin:setIntegrationFilter&plugin=" + filter
        });
    }
    if (mQuery('.native-integrations').length) {
        setTimeout(function() {
            var Shuffle = window.Shuffle,
                element = document.querySelector('.native-integrations'),
                shuffleOptions = {
                    itemSelector: '.shuffle-item'
                };
            window.nativeIntegrationsShuffleInstance = new Shuffle(element, shuffleOptions);
            window.nativeIntegrationsShuffleInstance.filter(function($el) {
                if (filter) {
                    return mQuery($el).hasClass('plugin' + filter);
                } else {
                    mQuery(shuffleOptions.itemSelector).first().css('transform', '');
                    return true;
                }
            });
            mQuery("html").on("fa.sidebar.minimize", function() {
                setTimeout(function() {
                    window.nativeIntegrationsShuffleInstance.update();
                }, 1000);
            }).on("fa.sidebar.maximize", function() {
                setTimeout(function() {
                    window.nativeIntegrationsShuffleInstance.update();
                }, 1000);
            });
            mQuery('#plugin-nav-tabs a').click(function() {
                setTimeout(function() {
                    window.nativeIntegrationsShuffleInstance.update();
                }, 500);
            });
        }, 500);
    }
};
Mautic.getIntegrationLeadFields = function(integration, el, settings) {
    if (typeof settings == 'undefined') {
        settings = {};
    }
    settings.integration = integration;
    settings.object = 'lead';
    Mautic.getIntegrationFields(settings, 1, el);
};
Mautic.getIntegrationCompanyFields = function(integration, el, settings) {
    if (typeof settings == 'undefined') {
        settings = {};
    }
    settings.integration = integration;
    settings.object = 'company';
    Mautic.getIntegrationFields(settings, 1, el);
};
Mautic.getIntegrationFields = function(settings, page, el) {
    var object = settings.object ? settings.object : 'lead';
    var fieldsTab = ('lead' === object) ? '#fields-tab' : '#' + object + '-fields-container';
    if (el && mQuery(el).is('input')) {
        Mautic.activateLabelLoadingIndicator(mQuery(el).attr('id'));
        var namePrefix = mQuery(el).attr('name').split('[')[0];
        if ('integration_details' !== namePrefix) {
            var nameParts = mQuery(el).attr('name').match(/\[.*?\]+/g);
            nameParts = nameParts.slice(0, -1);
            settings.prefix = namePrefix + nameParts.join('') + "[" + object + "Fields]";
        }
    }
    var fieldsContainer = '#' + object + 'FieldsContainer';
    var inModal = mQuery(fieldsContainer).closest('.modal');
    if (inModal) {
        var modalId = '#' + mQuery(fieldsContainer).closest('.modal').attr('id');
        Mautic.startModalLoadingBar(modalId);
    }
    Mautic.ajaxActionRequest('plugin:getIntegrationFields', {
        page: page,
        integration: (settings.integration) ? settings.integration : null,
        settings: settings
    }, function(response) {
        if (response.success) {
            mQuery(fieldsContainer).replaceWith(response.html);
            Mautic.onPageLoad(fieldsContainer);
            Mautic.integrationConfigOnLoad(fieldsContainer);
            if (mQuery(fieldsTab).length) {
                mQuery(fieldsTab).removeClass('hide');
            }
        } else {
            if (mQuery(fieldsTab).length) {
                mQuery(fieldsTab).addClass('hide');
            }
        }
        if (el) {
            Mautic.removeLabelLoadingIndicator();
        }
        if (inModal) {
            Mautic.stopModalLoadingBar(modalId);
        }
    });
};
Mautic.getIntegrationConfig = function(el, settings) {
    Mautic.activateLabelLoadingIndicator(mQuery(el).attr('id'));
    if (typeof settings == 'undefined') {
        settings = {};
    }
    settings.name = mQuery(el).attr('name');
    var data = {
        integration: mQuery(el).val(),
        settings: settings
    };
    mQuery('.integration-campaigns-status').html('');
    mQuery('.integration-config-container').html('');
    Mautic.ajaxActionRequest('plugin:getIntegrationConfig', data, function(response) {
        if (response.success) {
            mQuery('.integration-config-container').html(response.html);
            Mautic.onPageLoad('.integration-config-container', response);
        }
        Mautic.integrationConfigOnLoad('.integration-config-container');
        Mautic.removeLabelLoadingIndicator();
    });
};
Mautic.getIntegrationCampaignStatus = function(el, settings) {
    Mautic.activateLabelLoadingIndicator(mQuery(el).attr('id'));
    if (typeof settings == 'undefined') {
        settings = {};
    }
    var prefix = mQuery(el).attr('name').split("[")[0];
    settings.name = mQuery('#' + prefix + '_properties_integration').attr('name');
    var data = {
        integration: mQuery('#' + prefix + '_properties_integration').val(),
        campaign: mQuery(el).val(),
        settings: settings
    };
    mQuery('.integration-campaigns-status').html('');
    mQuery('.integration-campaigns-status').removeClass('hide');
    Mautic.ajaxActionRequest('plugin:getIntegrationCampaignStatus', data, function(response) {
        if (response.success) {
            mQuery('.integration-campaigns-status').append(response.html);
            Mautic.onPageLoad('.integration-campaigns-status', response);
        }
        Mautic.integrationConfigOnLoad('.integration-campaigns-status');
        Mautic.removeLabelLoadingIndicator();
    });
};
Mautic.getIntegrationCampaigns = function(el, settings) {
    Mautic.activateLabelLoadingIndicator(mQuery(el).attr('id'));
    var data = {
        integration: mQuery(el).val()
    };
    mQuery('.integration-campaigns').html('');
    Mautic.ajaxActionRequest('plugin:getIntegrationCampaigns', data, function(response) {
        if (response.success) {
            mQuery('.integration-campaigns').html(response.html);
            Mautic.onPageLoad('.integration-campaigns', response);
        }
        Mautic.integrationConfigOnLoad('.integration-campaigns');
        Mautic.removeLabelLoadingIndicator();
    });
};;
Mautic.pointOnLoad = function(container) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'point');
    }
};
Mautic.pointTriggerOnLoad = function(container) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'point.trigger');
    }
    if (mQuery('#triggerEvents')) {
        mQuery('#triggerEvents').sortable({
            items: '.trigger-event-row',
            handle: '.reorder-handle',
            stop: function(i) {
                mQuery.ajax({
                    type: "POST",
                    url: mauticAjaxUrl + "?action=point:reorderTriggerEvents",
                    data: mQuery('#triggerEvents').sortable("serialize") + "&triggerId=" + mQuery('#pointtrigger_sessionId').val()
                });
            }
        });
        mQuery('#triggerEvents .trigger-event-row').on('mouseover.triggerevents', function() {
            mQuery(this).find('.form-buttons').removeClass('hide');
        }).on('mouseout.triggerevents', function() {
            mQuery(this).find('.form-buttons').addClass('hide');
        }).on('dblclick.triggerevents', function(event) {
            event.preventDefault();
            mQuery(this).find('.btn-edit').first().click();
        });
    }
};
Mautic.pointTriggerEventOnLoad = function(container, response) {
    if (response.eventHtml) {
        var newHtml = response.eventHtml;
        var eventId = '#triggerEvent_' + response.eventId;
        if (mQuery(eventId).length) {
            mQuery(eventId).replaceWith(newHtml);
            var newField = false;
        } else {
            mQuery(newHtml).appendTo('#triggerEvents');
            var newField = true;
        }
        mQuery(eventId + " *[data-toggle='tooltip']").tooltip({
            html: true
        });
        mQuery(eventId + " a[data-toggle='ajax']").click(function(event) {
            event.preventDefault();
            return Mautic.ajaxifyLink(this, event);
        });
        mQuery(eventId + " a[data-toggle='ajaxmodal']").on('click.ajaxmodal', function(event) {
            event.preventDefault();
            Mautic.ajaxifyModal(this, event);
        });
        mQuery('#triggerEvents .trigger-event-row').off(".triggerevents");
        mQuery('#triggerEvents .trigger-event-row').on('mouseover.triggerevents', function() {
            mQuery(this).find('.form-buttons').removeClass('hide');
        }).on('mouseout.triggerevents', function() {
            mQuery(this).find('.form-buttons').addClass('hide');
        }).on('dblclick.triggerevents', function(event) {
            event.preventDefault();
            mQuery(this).find('.btn-edit').first().click();
        });
        if (!mQuery('#events-panel').hasClass('in')) {
            mQuery('a[href="#events-panel"]').trigger('click');
        }
        if (mQuery('#triggerEventPlaceholder').length) {
            mQuery('#triggerEventPlaceholder').remove();
        }
    }
};
Mautic.getPointActionPropertiesForm = function(actionType) {
    Mautic.activateLabelLoadingIndicator('point_type');
    var query = "action=point:getActionForm&actionType=" + actionType;
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            if (typeof response.html != 'undefined') {
                mQuery('#pointActionProperties').html(response.html);
                Mautic.onPageLoad('#pointActionProperties', response);
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            Mautic.removeLabelLoadingIndicator();
        }
    });
};
Mautic.EnablesOption = function(urlActionProperty) {
    if (urlActionProperty === 'point_properties_returns_within' && mQuery('#point_properties_returns_within').val() > 0) {
        mQuery('#point_properties_returns_after').val(0);
    } else {
        if (urlActionProperty === 'point_properties_returns_after' && mQuery('#point_properties_returns_after').val() > 0) {
            mQuery('#point_properties_returns_within').val(0);
        }
    }
};;
Mautic.reportOnLoad = function(container) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'report');
    }
    if (mQuery('div[id=report_filters]').length) {
        mQuery('div[id=report_filters]').attr('data-index', Mautic.getHighestIndex('report_filters'));
        mQuery('div[id=report_tableOrder]').attr('data-index', Mautic.getHighestIndex('report_tableOrder'));
        mQuery('div[id=report_aggregators]').attr('data-index', Mautic.getHighestIndex('report_aggregators'));
        if (mQuery('.filter-columns').length) {
            mQuery('.filter-columns').each(function() {
                Mautic.updateReportFilterValueInput(this, true);
                mQuery(this).on('change', function() {
                    Mautic.updateReportFilterValueInput(this);
                });
            });
        }
    } else {
        mQuery('#report-shelves .collapse').on('show.bs.collapse', function(e) {
            var actives = mQuery('#report-shelves').find('.in, .collapsing');
            actives.each(function(index, element) {
                mQuery(element).collapse('hide');
                var id = mQuery(element).attr('id');
                mQuery('a[aria-controls="' + id + '"]').addClass('collapsed');
            })
        })
    }
    Mautic.updateReportGlueTriggers();
    Mautic.checkSelectedGroupBy();
    Mautic.initDateRangePicker();
    var $isScheduled = mQuery('[data-report-schedule="isScheduled"]');
    var $unitTypeId = mQuery('[data-report-schedule="scheduleUnit"]');
    var $scheduleDay = mQuery('[data-report-schedule="scheduleDay"]');
    var $scheduleMonthFrequency = mQuery('[data-report-schedule="scheduleMonthFrequency"]');
    mQuery($isScheduled).change(function() {
        Mautic.scheduleDisplay($isScheduled, $unitTypeId, $scheduleDay, $scheduleMonthFrequency);
    });
    mQuery($unitTypeId).change(function() {
        Mautic.scheduleDisplay($isScheduled, $unitTypeId, $scheduleDay, $scheduleMonthFrequency);
    });
    mQuery($scheduleDay).change(function() {
        Mautic.schedulePreview($isScheduled, $unitTypeId, $scheduleDay, $scheduleMonthFrequency);
    });
    mQuery($scheduleMonthFrequency).change(function() {
        Mautic.schedulePreview($isScheduled, $unitTypeId, $scheduleDay, $scheduleMonthFrequency);
    });
    Mautic.scheduleDisplay($isScheduled, $unitTypeId, $scheduleDay, $scheduleMonthFrequency);
};
Mautic.scheduleDisplay = function($isScheduled, $unitTypeId, $scheduleDay, $scheduleMonthFrequency) {
    Mautic.checkIsScheduled($isScheduled);
    var unitVal = mQuery($unitTypeId).val();
    mQuery('#scheduleDay, #scheduleDay label, #scheduleMonthFrequency').hide();
    if (unitVal === 'WEEKLY' || unitVal === 'MONTHLY') {
        mQuery('#scheduleDay').show();
    }
    if (unitVal === 'MONTHLY') {
        mQuery('#scheduleMonthFrequency').show();
        mQuery('#scheduleDay label').hide();
    } else {
        mQuery('#scheduleDay label').show();
    }
    if ($isScheduled.length) {
        Mautic.schedulePreview($isScheduled, $unitTypeId, $scheduleDay, $scheduleMonthFrequency);
    }
};
Mautic.schedulePreview = function($isScheduled, $unitTypeId, $scheduleDay, $scheduleMonthFrequency) {
    var previewUrl = mQuery('#schedule_preview_url').data('url');
    var $schedulePreviewData = mQuery('#schedule_preview_data');
    var isScheduledVal = 0;
    if (!mQuery($isScheduled).prop("checked")) {
        isScheduledVal = 1;
    }
    if (!isScheduledVal) {
        $schedulePreviewData.hide();
        return;
    }
    var unitVal = mQuery($unitTypeId).val();
    var scheduleDayVal = mQuery($scheduleDay).val();
    var scheduleMonthFrequencyVal = mQuery($scheduleMonthFrequency).val();
    mQuery.get(previewUrl + '/' + isScheduledVal + '/' + unitVal + '/' + scheduleDayVal + '/' + scheduleMonthFrequencyVal, function(data) {
        if (!data.html) {
            return;
        }
        mQuery("#schedule_preview_data_content").html(data.html);
        $schedulePreviewData.show();
    });
};
Mautic.checkIsScheduled = function($isScheduled) {
    var $scheduleForm = mQuery('#schedule-container .schedule_form');
    if (!mQuery($isScheduled).prop("checked")) {
        $scheduleForm.show();
        return;
    }
    $scheduleForm.hide();
};
Mautic.addReportRow = function(elId) {
    var prototypeHolder = mQuery('div[id="' + elId + '"]');
    var index = parseInt(prototypeHolder.attr('data-index'));
    if (!index) {
        index = 0;
    }
    index++;
    var prototype = prototypeHolder.data('prototype');
    var output = prototype.replace(/__name__/g, index);
    prototypeHolder.attr('data-index', index);
    prototypeHolder.append(output);
    var newColumnId = '#' + elId + '_' + index + '_column';
    if (elId == 'report_filters') {
        if (typeof Mautic.reportPrototypeFilterOptions != 'undefined') {
            mQuery(newColumnId).html(Mautic.reportPrototypeFilterOptions);
        }
        mQuery('#report_filters_' + index + '_container').addClass('in-group');
        mQuery(newColumnId).on('change', function() {
            Mautic.updateReportFilterValueInput(this);
        });
        Mautic.updateReportFilterValueInput(newColumnId);
        Mautic.updateReportGlueTriggers();
    } else if (typeof Mautic.reportPrototypeColumnOptions != 'undefined') {
        mQuery(newColumnId).html(Mautic.reportPrototypeColumnOptions);
    }
    Mautic.activateChosenSelect(mQuery('#' + elId + '_' + index + '_column'));
    mQuery("#" + elId + " *[data-toggle='tooltip']").tooltip({
        html: true,
        container: 'body'
    });
};
Mautic.updateReportGlueTriggers = function() {
    var filterContainer = mQuery('#report_filters');
    var glueEl = filterContainer.find('.filter-glue');
    glueEl.off('change');
    glueEl.on('change', function() {
        var $this = mQuery(this);
        if ($this.val() === 'and') {
            $this.parents('.panel').addClass('in-group');
        } else {
            $this.parents('.panel').removeClass('in-group');
        }
    });
};
Mautic.updateReportFilterValueInput = function(filterColumn, setup) {
    var definitions = (typeof Mautic.reportPrototypeFilterDefinitions != 'undefined') ? Mautic.reportPrototypeFilterDefinitions : mQuery('#report_filters').data('filter-definitions');
    var operators = (typeof Mautic.reportPrototypeFilterOperators != 'undefined') ? Mautic.reportPrototypeFilterOperators : mQuery('#report_filters').data('filter-operators');
    var newValue = mQuery(filterColumn).val();
    if (!newValue) {
        return;
    }
    var filterId = mQuery(filterColumn).attr('id');
    var filterType = definitions[newValue].type;
    var valueEl = mQuery(filterColumn).parent().parent().find('.filter-value');
    var valueVal = valueEl.val();
    var idParts = filterId.split("_");
    var valueId = 'report_filters_' + idParts[2] + '_value';
    var valueName = 'report[filters][' + idParts[2] + '][value]';
    var currentOperator = mQuery('#report_filters_' + idParts[2] + '_condition').val();
    mQuery('#report_filters_' + idParts[2] + '_condition').html(operators[newValue]);
    if (mQuery('#report_filters_' + idParts[2] + '_condition option[value="' + currentOperator + '"]').length > 0) {
        mQuery('#report_filters_' + idParts[2] + '_condition').val(currentOperator);
    }
    Mautic.destroyChosen(mQuery('#' + valueId));
    if (filterType == 'bool' || filterType == 'boolean') {
        if (mQuery(valueEl).attr('type') != 'radio') {
            var template = mQuery('#filterValueYesNoTemplate .btn-group').clone(true);
            mQuery(template).find('input[type="radio"]').each(function() {
                mQuery(this).attr('name', valueName);
                var radioVal = mQuery(this).val();
                mQuery(this).attr('id', valueId + '_' + radioVal);
            });
            mQuery(valueEl).replaceWith(template);
        }
        if (setup) {
            mQuery('#' + valueId + '_' + valueVal).click();
        }
    } else if (mQuery(valueEl).attr('type') != 'text') {
        var newValueEl = mQuery('<input type="text" />').attr({
            id: valueId,
            name: valueName,
            'class': "form-control filter-value"
        });
        var replaceMe = (mQuery(valueEl).attr('type') == 'radio') ? mQuery(valueEl).parent().parent() : mQuery(valueEl);
        replaceMe.replaceWith(newValueEl);
    }
    if ((filterType == 'multiselect' || filterType == 'select') && typeof definitions[newValue].list != 'undefined') {
        var currentValue = mQuery(valueEl).val();
        var attr = {
            id: valueId,
            name: valueName,
            "class": 'form-control filter-value',
        };
        if (filterType == 'multiselect') {
            attr.multiple = true;
        }
        var newSelect = mQuery('<select />', attr);
        mQuery.each(definitions[newValue].list, function(value, label) {
            var newOption = mQuery('<option />').val(value).html(label);
            if (value == currentValue) {
                newOption.prop('selected', true);
            }
            newOption.appendTo(newSelect);
        });
        mQuery(valueEl).replaceWith(newSelect);
        Mautic.activateChosenSelect(newSelect);
    }
    if (filterType == 'datetime' || filterType == 'date' || filterType == 'time') {
        Mautic.activateDateTimeInputs('#' + valueId, filterType);
    } else if (mQuery('#' + valueId).hasClass('calendar-activated')) {
        mQuery('#' + valueId).datetimepicker('destroy');
    }
};
Mautic.removeReportRow = function(container) {
    mQuery("#" + container + " *[data-toggle='tooltip']").tooltip('destroy');
    mQuery('#' + container).remove();
};
Mautic.updateReportSourceData = function(context) {
    Mautic.activateLabelLoadingIndicator('report_source');
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: 'post',
        data: "action=report:getSourceData&context=" + context,
        success: function(response) {
            mQuery('#report_columns').html(response.columns);
            mQuery('#report_columns').multiSelect('refresh');
            mQuery('#report_groupBy').html(response.columns);
            mQuery('#report_groupBy').multiSelect('refresh');
            mQuery('#report_filters').find('div').remove().end();
            mQuery('#report_filters').data('index', 0);
            Mautic.reportPrototypeColumnOptions = mQuery(response.columns);
            mQuery('#report_tableOrder').find('div').remove().end();
            mQuery('#report_tableOrder').data('index', 0);
            mQuery('#report_aggregators').find('div').remove().end();
            mQuery('#report_aggregators').data('index', 0);
            Mautic.reportPrototypeFilterDefinitions = response.filterDefinitions;
            Mautic.reportPrototypeFilterOptions = response.filters;
            Mautic.reportPrototypeFilterOperators = response.filterOperators;
            mQuery('#report_graphs').html(response.graphs);
            mQuery('#report_graphs').multiSelect('refresh');
            if (!response.graphs) {
                mQuery('#graphs-container').addClass('hide');
                mQuery('#graphs-tab').addClass('hide');
            } else {
                mQuery('#graphs-container').removeClass('hide');
                mQuery('#graphs-tab').removeClass('hide');
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            Mautic.removeLabelLoadingIndicator();
        }
    });
};
Mautic.checkReportCondition = function(selector) {
    var option = mQuery('#' + selector + ' option:selected').val();
    var valueInput = selector.replace('condition', 'value');
    if (option == 'empty' || option == 'notEmpty') {
        mQuery('#' + valueInput).prop('disabled', true);
    } else {
        mQuery('#' + valueInput).prop('disabled', false);
    }
};
Mautic.checkSelectedGroupBy = function() {
    var selectedOption = mQuery("select[name='report[groupBy][]'] option:selected").length;
    var existingAggregators = mQuery("select[name*='report[aggregators]']");
    if (selectedOption > 0) {
        mQuery('#aggregators-button').prop('disabled', false);
    } else {
        existingAggregators.each(function() {
            var containerId = mQuery(this).attr('id').replace('_column', '');
            Mautic.removeReportRow(containerId + '_container');
        });
        mQuery('#aggregators-button').prop('disabled', true);
    }
};
Mautic.getHighestIndex = function(selector) {
    var highestIndex = 1;
    var selectorChildren = mQuery('#' + selector + ' > div');
    selectorChildren.each(function() {
        var index = parseInt(mQuery(this).attr('id').split('_')[2]);
        highestIndex = (index > highestIndex) ? index : highestIndex;
    });
    return parseInt(highestIndex);
};;
Mautic.smsOnLoad = function(container, response) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'sms');
    }
    if (mQuery('table.sms-list').length) {
        var ids = [];
        mQuery('td.col-stats').each(function() {
            var id = mQuery(this).attr('data-stats');
            ids.push(id);
        });
        while (ids.length > 0) {
            let batchIds = ids.splice(0, 10);
            Mautic.ajaxActionRequest('sms:getSmsCountStats', {
                ids: batchIds
            }, function(response) {
                if (response.success && response.stats) {
                    for (var i = 0; i < response.stats.length; i++) {
                        var stat = response.stats[i];
                        if (mQuery('#pending-' + stat.id).length) {
                            if (stat.pending) {
                                mQuery('#pending-' + stat.id + ' > a').html(stat.pending);
                                mQuery('#pending-' + stat.id).removeClass('hide');
                            }
                        }
                    }
                }
            }, false, true);
        }
    }
};
Mautic.selectSmsType = function(smsType) {
    if (smsType == 'list') {
        mQuery('#leadList').removeClass('hide');
        mQuery('#publishStatus').addClass('hide');
        mQuery('.page-header h3').text(mauticLang.newListSms);
    } else {
        mQuery('#publishStatus').removeClass('hide');
        mQuery('#leadList').addClass('hide');
        mQuery('.page-header h3').text(mauticLang.newTemplateSms);
    }
    mQuery('#sms_smsType').val(smsType);
    mQuery('body').removeClass('noscroll');
    mQuery('.sms-type-modal').remove();
    mQuery('.sms-type-modal-backdrop').remove();
};
Mautic.standardSmsUrl = function(options) {
    if (!options) {
        return;
    }
    var url = options.windowUrl;
    if (url) {
        var editEmailKey = '/sms/edit/smsId';
        if (url.indexOf(editEmailKey) > -1) {
            options.windowUrl = url.replace('smsId', mQuery('#campaignevent_properties_sms').val());
        }
    }
    return options;
};
Mautic.disabledSmsAction = function(opener) {
    if (typeof opener == 'undefined') {
        opener = window;
    }
    var sms = opener.mQuery('#campaignevent_properties_sms').val();
    var disabled = sms === '' || sms === null;
    opener.mQuery('#campaignevent_properties_editSmsButton').prop('disabled', disabled);
};;
Mautic.getStageActionPropertiesForm = function(actionType) {
    Mautic.activateLabelLoadingIndicator('stage_type');
    var query = "action=stage:getActionForm&actionType=" + actionType;
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            if (typeof response.html != 'undefined') {
                mQuery('#stageActionProperties').html(response.html);
                Mautic.onPageLoad('#stageActionProperties', response);
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            Mautic.removeLabelLoadingIndicator();
        }
    });
};;
Mautic.userOnLoad = function(container) {
    if (mQuery(container + ' form[name="user"]').length) {
        if (mQuery('#user_position').length) {
            Mautic.activateTypeahead('#user_position', {
                displayKey: 'position'
            });
        }
    } else {
        if (mQuery(container + ' #list-search').length) {
            Mautic.activateSearchAutocomplete('list-search', 'user.user');
        }
    }
};
Mautic.roleOnLoad = function(container, response) {
    if (mQuery(container + ' #list-search').length) {
        Mautic.activateSearchAutocomplete('list-search', 'user.role');
    }
    if (response && response.permissionList) {
        MauticVars.permissionList = response.permissionList;
    }
};
Mautic.togglePermissionVisibility = function() {
    setTimeout(function() {
        if (mQuery('#role_isAdmin_0').prop('checked')) {
            mQuery('#rolePermissions').removeClass('hide');
            mQuery('#isAdminMessage').addClass('hide');
        } else {
            mQuery('#rolePermissions').addClass('hide');
            mQuery('#isAdminMessage').removeClass('hide');
        }
    }, 10);
};
Mautic.onPermissionChange = function(changedPermission, bundle) {
    var granted = 0;
    if (mQuery(changedPermission).prop('checked')) {
        if (mQuery(changedPermission).val() == 'full') {
            mQuery(changedPermission).closest('.choice-wrapper').find("label input:checkbox:checked").map(function() {
                if (mQuery(this).val() != 'full') {
                    mQuery(this).prop('checked', false);
                    mQuery(this).parent().toggleClass('active');
                }
            })
        } else {
            mQuery(changedPermission).closest('.choice-wrapper').find("label input:checkbox:checked").map(function() {
                if (mQuery(this).val() == 'full') {
                    granted = granted - 1;
                    mQuery(this).prop('checked', false);
                    mQuery(this).parent().toggleClass('active');
                }
            })
        }
    }
    if (mQuery('.' + bundle + '_granted').length) {
        var granted = 0;
        var levelPerms = MauticVars.permissionList[bundle];
        mQuery.each(levelPerms, function(level, perms) {
            mQuery.each(perms, function(index, perm) {
                var isChecked = mQuery('input[data-permission="' + bundle + ':' + level + ':' + perm + '"]').prop('checked');
                if (perm == 'full') {
                    if (isChecked) {
                        if (perms.length === 1) {
                            granted++;
                        } else {
                            granted += perms.length - 1;
                        }
                    }
                } else if (isChecked) {
                    granted++;
                }
            });
        });
        mQuery('.' + bundle + '_granted').html(granted);
    }
};;
Mautic.sendHookTest = function() {
    var url = mQuery('#webhook_webhookUrl').val();
    var secret = mQuery('#webhook_secret').val();
    var eventTypes = mQuery("#event-types input[type='checkbox']");
    var selectedTypes = [];
    eventTypes.each(function() {
        var item = mQuery(this);
        if (item.is(':checked')) {
            selectedTypes.push(item.val());
        }
    });
    var data = {
        action: 'webhook:sendHookTest',
        url: url,
        secret: secret,
        types: selectedTypes
    };
    var spinner = mQuery('#spinner');
    spinner.removeClass('hide');
    mQuery.ajax({
        url: mauticAjaxUrl,
        data: data,
        type: 'POST',
        dataType: "json",
        success: function(response) {
            if (response.success) {
                mQuery('#tester').html(response.html);
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function(response) {
            spinner.addClass('hide');
        }
    })
};;
Mautic.disabledFocusActions = function(opener) {
    if (typeof opener == 'undefined') {
        opener = window;
    }
    var email = opener.mQuery('#campaignevent_properties_focus').val();
    var disabled = email === '' || email === null;
    opener.mQuery('#campaignevent_properties_editFocusButton').prop('disabled', disabled);
    opener.mQuery('#campaignevent_properties_previewFocusButton').prop('disabled', disabled);
};
Mautic.focusOnLoad = function() {
    if (mQuery('.builder').length) {
        mQuery('.btn-dropper').each(function() {
            mQuery(this).click(function() {
                if (mQuery(this).hasClass('active')) {
                    mQuery(this).removeClass('active btn-primary').addClass('btn-default');
                    mQuery('#websiteCanvas').css('cursor', 'inherit');
                } else {
                    mQuery('.btn-dropper').removeClass('active btn-primary').addClass('btn-default');
                    mQuery(this).removeClass('btn-default').addClass('active btn-primary');
                    mQuery('#websiteCanvas').css('cursor', 'crosshair');
                }
            });
        });
        var activateType = function(el, thisType) {
            mQuery('[data-focus-type]').removeClass('focus-active');
            mQuery(el).addClass('focus-active');
            mQuery('#focusFormContent').removeClass(function(index, css) {
                return (css.match(/(^|\s)focus-type\S+/g) || []).join(' ');
            }).addClass('focus-type-' + thisType);
            mQuery('.focus-type-header').removeClass('text-danger');
            mQuery('#focus_type').val(thisType);
            var props = '.focus-' + thisType + '-properties';
            mQuery('#focusTypeProperties').appendTo(mQuery(props)).removeClass('hide');
            mQuery('#focusType .focus-properties').each(function() {
                if (!mQuery(this).is(':hidden') && mQuery(this).data('focus-type') != thisType) {
                    mQuery(this).slideUp('fast', function() {
                        mQuery(this).hide();
                    });
                }
            });
            if (mQuery(props).length) {
                if (mQuery(props).is(':hidden')) {
                    mQuery(props).slideDown('fast');
                }
            }
        }
        mQuery('[data-focus-type]').on({
            click: function() {
                var thisType = mQuery(this).data('focus-type');
                if (mQuery('#focus_type').val() == thisType) {
                    return;
                }
                activateType(this, thisType);
                Mautic.focusUpdatePreview();
            },
            mouseenter: function() {
                mQuery(this).addClass('focus-hover');
            },
            mouseleave: function() {
                mQuery(this).removeClass('focus-hover');
            }
        });
        var activateStyle = function(el, thisStyle) {
            mQuery('[data-focus-style]').removeClass('focus-active');
            mQuery(el).addClass('focus-active');
            if (!mQuery('#focusType').hasClass('hidden-focus-style-all')) {
                mQuery('#focusType').addClass('hidden-focus-style-all');
            }
            mQuery('#focusFormContent').removeClass(function(index, css) {
                return (css.match(/(^|\s)focus-style\S+/g) || []).join(' ');
            }).addClass('focus-style-' + thisStyle);
            mQuery('.focus-style-header').removeClass('text-danger');
            mQuery('#focus_style').val(thisStyle);
            var props = '.focus-' + thisStyle + '-properties';
            mQuery('#focusStyleProperties').appendTo(mQuery(props)).removeClass('hide');
            mQuery('#focusStyle .focus-properties').each(function() {
                if (!mQuery(this).is(':hidden')) {
                    mQuery(this).slideUp('fast', function() {
                        mQuery(this).hide();
                    });
                }
            });
            if (mQuery(props).length) {
                if (mQuery(props).is(':hidden')) {
                    mQuery(props).slideDown('fast');
                }
            }
        };
        mQuery('[data-focus-style]').on({
            click: function() {
                var thisStyle = mQuery(this).data('focus-style');
                if (mQuery('#focus_style').val() == thisStyle) {
                    return;
                }
                activateStyle(this, thisStyle);
                Mautic.focusUpdatePreview();
            },
            mouseenter: function() {
                mQuery(this).addClass('focus-hover');
            },
            mouseleave: function() {
                mQuery(this).removeClass('focus-hover');
            }
        });
        var currentType = mQuery('#focus_type').val();
        if (currentType) {
            activateType(mQuery('[data-focus-type="' + currentType + '"]'), currentType);
        }
        var currentStyle = mQuery('#focus_style').val();
        if (currentStyle) {
            activateStyle(mQuery('[data-focus-style="' + currentStyle + '"]'), currentStyle);
        }
        mQuery('#focus_properties_content_font').on('chosen:showing_dropdown', function() {
            var arrayIndex = 1;
            mQuery('#focus_properties_content_font option').each(function() {
                mQuery('#focus_properties_content_font_chosen li[data-option-array-index="' + arrayIndex + '"]').css('fontFamily', mQuery(this).attr('value'));
                arrayIndex++;
            });
        });
        mQuery('.btn-fetch').on('click', function() {
            var url = mQuery('#websiteUrlPlaceholderInput').val();
            if (url) {
                mQuery('#focus_website').val(url);
                Mautic.launchFocusBuilder();
            } else {
                return;
            }
        });
        Mautic.focusInitViewportSwitcher();
        mQuery('#focus_editor').on('froalaEditor.contentChanged', function(e, editor) {
            var content = editor.html.get();
            if (content.indexOf('{focus_form}') !== -1) {
                Mautic.focusUpdatePreview();
            } else {
                mQuery('.mf-content').html(content);
            }
        });
    } else {
        Mautic.initDateRangePicker();
    }
};
Mautic.launchFocusBuilder = function(forceFetch) {
    mQuery('.website-placeholder').addClass('hide');
    mQuery('body').css('overflow-y', 'hidden');
    Mautic.ignoreMauticFocusPreviewUpdate = true;
    if (!mQuery('#builder-overlay').length) {
        var builderCss = {
            margin: "0",
            padding: "0",
            border: "none",
            width: "100%",
            height: "100%"
        };
        var spinnerLeft = (mQuery(document).width() - 300) / 2;
        var overlay = mQuery('<div id="builder-overlay" class="modal-backdrop fade in"><div style="position: absolute; top:50%; left:' + spinnerLeft + 'px"><i class="fa fa-spinner fa-spin fa-5x"></i></div></div>').css(builderCss).appendTo('.builder-content');
    }
    mQuery('.btn-close-builder').prop('disabled', true);
    mQuery('.builder').addClass('builder-active').removeClass('hide');
    var url = mQuery('#focus_website').val();
    if (!url) {
        if (!mQuery('#focus_unlockId').val()) {
            Mautic.setFocusDefaultColors();
        }
        mQuery('.website-placeholder').removeClass('hide');
        mQuery('#builder-overlay').addClass('hide');
        mQuery('.btn-close-builder').prop('disabled', false);
        mQuery('#websiteUrlPlaceholderInput').prop('disabled', false);
        mQuery('#websiteCanvas').html('');
        mQuery('.website-placeholder').show();
        mQuery('#websiteUrlPlaceholderInput').val('');
        Mautic.focusUpdatePreview();
    } else {
        mQuery('#websiteUrlPlaceholderInput').val(url).prop('disabled', false);
        let iframe = mQuery('#websiteCanvas iframe');
        if (!forceFetch && iframe.length && url === iframe.attr('src')) {
            return;
        }
        mQuery('#builder-overlay').removeClass('hide');
        Mautic.loadedPreviewImage = url;
        var data = {
            id: mQuery('#focus_unlockId').val(),
            website: url
        }
        mQuery('.preview-body').html('');
        Mautic.ajaxActionRequest('plugin:focus:checkIframeAvailability', data, function(response) {
            if (response.errorMessage.length) {
                mQuery('.website-placeholder').addClass('has-error').find('.help-block').html(response.errorMessage).removeClass('hide');
                mQuery('#builder-overlay').hide();
                mQuery('.website-placeholder').removeClass('hide').show();
                mQuery('#websiteCanvas').html('');
                mQuery('.builder-panel-top p button').prop('disabled', false);
                return;
            }
            mQuery('#builder-overlay').addClass('hide');
            mQuery('.btn-close-builder').prop('disabled', false);
            mQuery('.website-placeholder').removeClass('hide');
            mQuery('#websiteUrlPlaceholderInput').prop('disabled', false);
            mQuery('.btn-dropper').addClass('disabled');
            Mautic.focusCreateIframe(url);
            Mautic.ignoreMauticFocusPreviewUpdate = false;
        });
    }
};
Mautic.focusUpdatePreview = function() {
    var data = mQuery('form[name=focus]').formToArray();
    Mautic.ajaxActionRequest('plugin:focus:generatePreview', data, function(response) {
        var container = mQuery('<div />');
        var innerContainer = mQuery('<div />').html(response.html);
        if (mQuery('.btn-viewport').data('viewport') == 'mobile') {
            innerContainer.addClass('mf-responsive');
        } else {
            innerContainer.removeClass('mf-responsive');
        }
        container.append(innerContainer);
        mQuery('.preview-body').html(container);
        if (!mQuery('.mf-bar').length && mQuery('.builder-content').length) {
            mQuery('.builder-content').on('click', function() {
                Mautic.closeFocusModal(mQuery('#focus_style').val());
            });
            mQuery('.mautic-focus').on('click', function(e) {
                e.stopPropagation();
            });
        }
    });
};
Mautic.setFocusDefaultColors = function() {
    mQuery('#focus_properties_colors_primary').minicolors('value', '4e5d9d');
    mQuery('#focus_properties_colors_text').minicolors('value', (mQuery('#focus_style').val() == 'bar') ? 'ffffff' : '000000');
    mQuery('#focus_properties_colors_button').minicolors('value', 'fdb933');
    mQuery('#focus_properties_colors_button_text').minicolors('value', 'ffffff');
};
Mautic.toggleBarCollapse = function() {
    var svg = '.mf-bar-collapser-icon svg';
    var currentSize = mQuery(svg).data('transform-size');
    var currentDirection = mQuery(svg).data('transform-direction');
    var currentScale = mQuery(svg).data('transform-scale');
    var newDirection = (parseInt(currentDirection) * -1);
    setTimeout(function() {
        mQuery(svg).find('g').first().attr('transform', 'scale(' + currentScale + ') rotate(' + newDirection + ' ' + currentSize + ' ' + currentSize + ')');
        mQuery(svg).data('transform-direction', newDirection);
    }, 500);
    if (mQuery('.mf-bar-collapser').hasClass('mf-bar-collapsed')) {
        if (mQuery('.mf-bar').hasClass('mf-bar-top')) {
            mQuery('.mf-bar').css('margin-top', 0);
        } else {
            mQuery('.mf-bar').css('margin-bottom', 0);
        }
        mQuery('.mf-bar-collapser').removeClass('mf-bar-collapsed');
    } else {
        if (mQuery('.mf-bar').hasClass('mf-bar-top')) {
            mQuery('.mf-bar').css('margin-top', -60);
        } else {
            mQuery('.mf-bar').css('margin-bottom', -60);
        }
        mQuery('.mf-bar-collapser').addClass('mf-bar-collapsed');
    }
}
Mautic.closeFocusModal = function(style) {
    mQuery('.mf-' + style).remove();
    if (mQuery('.mf-' + style + '-overlay').length) {
        mQuery('.mf-' + style + '-overlay').remove();
    }
}
Mautic.closeFocusBuilder = function(el) {
    if (typeof Mautic.ajaxActionXhr != 'undefined' && typeof Mautic.ajaxActionXhr['plugin:focus:generatePreview'] != 'undefined') {
        Mautic.ajaxActionXhr['plugin:focus:generatePreview'].abort();
        delete Mautic.ajaxActionXhr['plugin:focus:generatePreview'];
    }
    Mautic.stopIconSpinPostEvent();
    mQuery('.builder').removeClass('builder-active').addClass('hide');
    mQuery('body').css('overflow-y', '');
};
Mautic.focusInitViewportSwitcher = function() {
    mQuery('.btn-viewport').on('click', function() {
        if (mQuery(this).data('viewport') == 'mobile') {
            mQuery('.btn-viewport i').removeClass('fa-desktop fa-2x').addClass('fa-mobile-phone fa-3x');
            mQuery(this).data('viewport', 'desktop');
            Mautic.launchFocusBuilder(true);
        } else {
            mQuery('.btn-viewport i').removeClass('fa-mobile-phone fa-3x').addClass('fa-desktop fa-2x');
            mQuery(this).data('viewport', 'mobile');
            Mautic.launchFocusBuilder(true);
        }
    });
}
Mautic.focusCreateIframe = function(url) {
    let builderCss = {
        "pointer-events": "none",
    };
    if (mQuery('.btn-viewport').data('viewport') === 'mobile') {
        mQuery('#websiteScreenshot').addClass('mobile');
    } else {
        builderCss.width = "100%";
        builderCss.height = mQuery('#websiteScreenshot').height();
        mQuery('#websiteScreenshot').removeClass('mobile');
    }
    try {
        mQuery('#websiteCanvas').html('<iframe src="' + url + '" scrolling="no" frameBorder="0"></iframe>');
        mQuery('#websiteCanvas iframe').css(builderCss);
    } catch (err) {
        alert(err.toString());
    } finally {
        mQuery('.website-placeholder').hide();
        Mautic.focusUpdatePreview();
    }
};
Mautic.testFullContactApi = function(btn) {
    mQuery(btn).prop('disabled', true);
    var apikey = mQuery('#integration_details_apiKeys_apikey').val();
    var d = new Date();
    var month = d.getMonth() + 1;
    var period = d.getFullYear() + '-' + ((month < 10) ? '0' + month : month);
    var months = new Array();
    months[0] = "January";
    months[1] = "February";
    months[2] = "March";
    months[3] = "April";
    months[4] = "May";
    months[5] = "June";
    months[6] = "July";
    months[7] = "August";
    months[8] = "September";
    months[9] = "October";
    months[10] = "November";
    months[11] = "December";
    var dateString = months[month - 1] + ' ' + d.getFullYear();
    var EOL = String.fromCharCode(13);
    mQuery.get('https://api.fullcontact.com/v2/stats.json?apiKey=' + apikey + '&period=' + period, function(stats) {
        var person = null;
        var company = null;
        var free = null;
        mQuery.each(stats.metrics, function(i, m) {
            if ('200' === m.metricId) {
                person = m;
            } else if ('company_200' === m.metricId) {
                company = m;
            } else if ('200_free' === m.metricId) {
                free = m;
            }
        });
        var result = 'Plan Details: ' + stats.plan + EOL + EOL + 'Quick Usage Stats for ' + dateString + ':' + EOL;
        if (person) {
            result += ' - Person API: ' + person.usage + ' matches used from ' + person.planLevel + ' (' + person.remaining + ' remaining)' + EOL;
        }
        if (company) {
            result += ' - Company API: ' + company.usage + ' matches used from ' + company.planLevel + ' (' + company.remaining + ' remaining)' + EOL;
        }
        if (free) {
            result += ' - Name/Location/Stats: ' + free.usage + ' matches used from ' + free.planLevel + ' (' + free.remaining + ' remaining)' + EOL;
        }
        mQuery('#integration_details_apiKeys_stats').val(result);
    }).fail(function(error) {
        mQuery('#integration_details_apiKeys_stats').val((error.responseJSON && error.responseJSON.message) ? error.responseJSON.message : 'Error: ' + JSON.stringify(error));
    });
    mQuery(btn).prop('disabled', false);
};;
Mautic.getNetworkFormAction = function(networkType) {
    if (networkType && mQuery(networkType).val() && mQuery(networkType).closest('.form-group').hasClass('has-error')) {
        mQuery(networkType).closest('.form-group').removeClass('has-error');
        if (mQuery(networkType).next().hasClass('help-block')) {
            mQuery(networkType).next().remove();
        }
    }
    Mautic.activateLabelLoadingIndicator('monitoring_networkType');
    var query = "action=plugin:mauticSocial:getNetworkForm&networkType=" + mQuery(networkType).val();
    mQuery.ajax({
        url: mauticAjaxUrl,
        type: "POST",
        data: query,
        dataType: "json",
        success: function(response) {
            if (typeof response.html != 'undefined') {
                mQuery('#properties-container').html(response.html);
                if (response.html != '') {
                    Mautic.onPageLoad('#properties-container', response);
                }
            }
        },
        error: function(request, textStatus, errorThrown) {
            Mautic.processAjaxError(request, textStatus, errorThrown);
        },
        complete: function() {
            Mautic.removeLabelLoadingIndicator();
        }
    });
};
Mautic.composeSocialWatcher = function() {
    var input = mQuery('textarea.tweet-message');
    Mautic.updateCharacterCount();
    input.on('keyup', function() {
        Mautic.updateCharacterCount();
    });
    var pageId = mQuery('select.tweet-insert-page');
    var assetId = mQuery('select.tweet-insert-asset');
    var handle = mQuery('button.tweet-insert-handle');
    pageId.on('change', function() {
        Mautic.insertSocialLink(pageId.val(), 'pagelink', false);
    });
    assetId.on('change', function() {
        Mautic.insertSocialLink(assetId.val(), 'assetlink', false);
    });
    handle.on('click', function() {
        Mautic.insertSocialLink(false, 'twitter_handle', true);
    });
};
Mautic.getCharacterCount = function() {
    var tweetLenght = 280;
    var currentLength = mQuery('textarea#twitter_tweet_text');
    return (tweetLenght - currentLength.val().length);
};
Mautic.updateCharacterCount = function() {
    var tweetCount = Mautic.getCharacterCount();
    var countContainer = mQuery('#character-count span');
    countContainer.text(tweetCount);
};
Mautic.insertSocialLink = function(id, type, skipId) {
    if (!id && !skipId) {
        return;
    }
    if (skipId) {
        var link = '{' + type + '}';
    } else {
        var link = '{' + type + '=' + id + '}';
    }
    var textarea = mQuery('textarea.tweet-message');
    var currentVal = textarea.val();
    var newVal = (currentVal) ? currentVal + ' ' + link : link;
    textarea.val(newVal);
    Mautic.updateCharacterCount();
};