/* global ajaxurl, tinymce, wpLinkL10n, wpActiveEditor */
var wpLink;

( function( $ ) {
	var inputs = {}, rivers = {}, ed, River, Query;

	wpLink = {
		timeToTriggerRiver: 150,
		minRiverAJAXDuration: 200,
		riverBottomThreshold: 5,
		keySensitivity: 100,
		lastSearch: '',
		textarea: '',

		init: function() {
			inputs.dialog = $( '#link-modal' );
			inputs.backdrop = $( '#link-modal-backdrop' );
			inputs.close = $( '#link-modal-close' );
			inputs.submit = $( '#wp-link-submit' );
			inputs.url = $( '#url-field' );
			inputs.nonce = $( '#_ajax_linking_nonce' );
			inputs.title = $( '#link-title-field' );
			inputs.openInNewTab = $( '#link-target-checkbox' );
			inputs.search = $( '#search-field' );

			rivers.search = new River( $( '#search-results' ) );
			rivers.recent = new River( $( '#most-recent-results' ) );
			rivers.elements = $( '.query-results', inputs.dialog );

			inputs.dialog.keydown( wpLink.keydown );
			inputs.dialog.keyup( wpLink.keyup );

			inputs.submit.click( function( event ){
				event.preventDefault();
				wpLink.update();
			});

			inputs.close.click( wpLink.close );
			inputs.backdrop.click( wpLink.close );

			inputs.search.focus( function() {
				inputs.dialog.addClass( 'link-modal-toggled' );
			});
			inputs.url.add( inputs.title ).focus( function() {
				inputs.dialog.removeClass( 'link-modal-toggled' );
			});

			rivers.elements.on( 'river-select', wpLink.updateFields );

			inputs.search.keyup( wpLink.searchInternalLinks );
		},

		open: function( editorId ) {
			wpLink.range = null;

			if ( ! wpLink.isMCE() && document.selection ) {
				wpLink.textarea.focus();
				wpLink.range = document.selection.createRange();
			}

			if ( editorId ) {
				window.wpActiveEditor = editorId;
			}

			if ( ! window.wpActiveEditor ) {
				return;
			}

			this.textarea = $( '#' + wpActiveEditor ).get( 0 );

			if ( typeof tinymce !== 'undefined' ) {
				ed = tinymce.get( wpActiveEditor );

				if ( ed && tinymce.isIE ) {
					ed.windowManager.bookmark = ed.selection.getBookmark();
				}
			}

			inputs.dialog.show();
			inputs.backdrop.show();
			
			wpLink.refresh();
		},

		isMCE: function() {
			return ed;
		},

		refresh: function() {
			// Refresh rivers (clear links, check visibility)
			rivers.search.refresh();
			rivers.recent.refresh();

			if ( wpLink.isMCE() ) {
				wpLink.mceRefresh();
			} else {
				wpLink.setDefaultValues();
			}

			// Focus the URL field and highlight its contents.
			// If this is moved above the selection changes,
			// IE will show a flashing cursor over the dialog.
			inputs.url.focus()[0].select();
			// Load the most recent results if this is the first time opening the panel.
			if ( ! rivers.recent.ul.children().length )
				rivers.recent.ajax();
		},

		mceRefresh: function() {
			var e;

			// If link exists, select proper values.
			if ( e = ed.dom.getParent( ed.selection.getNode(), 'A' ) ) {
				// Set URL and description.
				inputs.url.val( ed.dom.getAttrib( e, 'href' ) );
				inputs.title.val( ed.dom.getAttrib( e, 'title' ) );
				// Set open in new tab.
				inputs.openInNewTab.prop( 'checked', ( '_blank' === ed.dom.getAttrib( e, 'target' ) ) );
				// Update save prompt.
				inputs.submit.val( wpLinkL10n.update );

			// If there's no link, set the default values.
			} else {
				wpLink.setDefaultValues();
			}
		},

		close: function() {
			if ( ! wpLink.isMCE() ) {
				wpLink.textarea.focus();

				if ( wpLink.range ) {
					wpLink.range.moveToBookmark( wpLink.range.getBookmark() );
					wpLink.range.select();
				}
			}
			inputs.dialog.hide();
			inputs.backdrop.hide();
		},

		getAttrs: function() {
			return {
				href: inputs.url.val(),
				title: inputs.title.val(),
				target: inputs.openInNewTab.prop('checked') ? '_blank' : ''
			};
		},

		update: function() {
			if ( wpLink.isMCE() ) {
				wpLink.mceUpdate();
			} else {
				wpLink.htmlUpdate();
			}
		},

		htmlUpdate: function() {
			var attrs, html, begin, end, cursor, title, selection,
				textarea = wpLink.textarea;

			if ( ! textarea )
				return;

			attrs = wpLink.getAttrs();

			// If there's no href, return.
			if ( ! attrs.href || attrs.href == 'http://' )
				return;

			// Build HTML
			html = '<a href="' + attrs.href + '"';

			if ( attrs.title ) {
				title = attrs.title.replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
				html += ' title="' + title + '"';
			}

			if ( attrs.target ) {
				html += ' target="' + attrs.target + '"';
			}

			html += '>';

			// Insert HTML
			if ( document.selection && wpLink.range ) {
				// IE
				// Note: If no text is selected, IE will not place the cursor
				//       inside the closing tag.
				textarea.focus();
				wpLink.range.text = html + wpLink.range.text + '</a>';
				wpLink.range.moveToBookmark( wpLink.range.getBookmark() );
				wpLink.range.select();

				wpLink.range = null;
			} else if ( typeof textarea.selectionStart !== 'undefined' ) {
				// W3C
				begin = textarea.selectionStart;
				end = textarea.selectionEnd;
				selection = textarea.value.substring( begin, end );
				html = html + selection + '</a>';
				cursor = begin + html.length;

				// If no text is selected, place the cursor inside the closing tag.
				if ( begin == end )
					cursor -= '</a>'.length;

				textarea.value = textarea.value.substring( 0, begin ) + html +
					textarea.value.substring( end, textarea.value.length );

				// Update cursor position
				textarea.selectionStart = textarea.selectionEnd = cursor;
			}

			wpLink.close();
			textarea.focus();
		},

		mceUpdate: function() {
			var link,
				attrs = wpLink.getAttrs();

			wpLink.close();
			ed.focus();

			if ( tinymce.isIE ) {
				ed.selection.moveToBookmark( ed.windowManager.bookmark );
			}

			link = ed.dom.getParent( ed.selection.getNode(), 'a[href]' );

			// If the values are empty, unlink and return
			if ( ! attrs.href || attrs.href == 'http://' ) {
				ed.execCommand('unlink');
				return;
			}

			if ( link ) {
				ed.dom.setAttribs( link, attrs );
			} else {
				ed.execCommand( 'mceInsertLink', false, attrs );
			}

			// Move the cursor to the end of the selection
			ed.selection.collapse();
		},

		updateFields: function( e, li, originalEvent ) {
			inputs.url.val( li.children( '.item-permalink' ).val() );
			inputs.title.val( li.hasClass( 'no-title' ) ? '' : li.children( '.item-title' ).text() );
			if ( originalEvent && originalEvent.type == 'click' )
				inputs.url.focus();
		},

		setDefaultValues: function() {
			// Set URL and description to defaults.
			// Leave the new tab setting as-is.
			inputs.url.val( 'http://' );
			inputs.title.val( '' );

			// Update save prompt.
			inputs.submit.val( wpLinkL10n.save );
		},

		searchInternalLinks: function() {
			var t = $(this), waiting,
				search = t.val();

			if ( search.length > 2 ) {
				rivers.recent.hide();
				rivers.search.show();

				// Don't search if the keypress didn't change the title.
				if ( wpLink.lastSearch == search )
					return;

				wpLink.lastSearch = search;
				waiting = t.parent().find( '.spinner' ).show();

				rivers.search.change( search );
				rivers.search.ajax( function(){
					waiting.hide();
				});
			} else {
				rivers.search.hide();
				rivers.recent.show();
			}
		},

		next: function() {
			rivers.search.next();
			rivers.recent.next();
		},

		prev: function() {
			rivers.search.prev();
			rivers.recent.prev();
		},

		keydown: function( event ) {
			var fn, key = $.ui.keyCode;

			if ( key.ESCAPE === event.which ) {
				wpLink.close();
				event.stopImmediatePropagation();
			}

			if ( event.which !== key.UP && event.which !== key.DOWN ) {
				return;
			}

			fn = event.which === key.UP ? 'prev' : 'next';
			clearInterval( wpLink.keyInterval );
			wpLink[ fn ]();
			wpLink.keyInterval = setInterval( wpLink[ fn ], wpLink.keySensitivity );
			event.preventDefault();
		},

		keyup: function( event ) {
			var key = $.ui.keyCode;

			if ( event.which === key.UP || event.which === key.DOWN ) {
				clearInterval( wpLink.keyInterval );
				event.preventDefault();
			}
		},

		delayedCallback: function( func, delay ) {
			var timeoutTriggered, funcTriggered, funcArgs, funcContext;

			if ( ! delay )
				return func;

			setTimeout( function() {
				if ( funcTriggered )
					return func.apply( funcContext, funcArgs );
				// Otherwise, wait.
				timeoutTriggered = true;
			}, delay);

			return function() {
				if ( timeoutTriggered )
					return func.apply( this, arguments );
				// Otherwise, wait.
				funcArgs = arguments;
				funcContext = this;
				funcTriggered = true;
			};
		}
	};

	River = function( element, search ) {
		var self = this;
		this.element = element;
		this.ul = element.children( 'ul' );
		this.contentHeight = element.children( '#link-modal-content-height' );
		this.waiting = element.find( '.river-waiting' );

		this.change( search );
		this.refresh();

		$( '#link-modal-content' ).scroll( function() {
			self.maybeLoad();
		});
		element.delegate( 'li', 'click', function( event ) {
			self.select( $(this), event );
		});
	};

	$.extend( River.prototype, {
		refresh: function() {
			this.deselect();
			this.visible = this.element.is( ':visible' );
		},
		show: function() {
			if ( ! this.visible ) {
				this.deselect();
				this.element.show();
				this.visible = true;
			}
		},
		hide: function() {
			this.element.hide();
			this.visible = false;
		},
		// Selects a list item and triggers the river-select event.
		select: function( li, event ) {
			var liHeight, elHeight, liTop, elTop;

			if ( li.hasClass( 'unselectable' ) || li == this.selected )
				return;

			this.deselect();
			this.selected = li.addClass( 'selected' );
			// Make sure the element is visible
			liHeight = li.outerHeight();
			elHeight = this.element.height();
			liTop = li.position().top;
			elTop = this.element.scrollTop();

			if ( liTop < 0 ) { // Make first visible element
				this.element.scrollTop( elTop + liTop );
			} else if ( liTop + liHeight > elHeight ) { // Make last visible element
				this.element.scrollTop( elTop + liTop - elHeight + liHeight );
			}

			// Trigger the river-select event
			this.element.trigger( 'river-select', [ li, event, this ] );
		},
		deselect: function() {
			if ( this.selected )
				this.selected.removeClass( 'selected' );
			this.selected = false;
		},
		prev: function() {
			if ( ! this.visible )
				return;

			var to;
			if ( this.selected ) {
				to = this.selected.prev( 'li' );
				if ( to.length )
					this.select( to );
			}
		},
		next: function() {
			if ( ! this.visible )
				return;

			var to = this.selected ? this.selected.next( 'li' ) : $( 'li:not(.unselectable):first', this.element);
			if ( to.length )
				this.select( to );
		},
		ajax: function( callback ) {
			var self = this,
				delay = this.query.page == 1 ? 0 : wpLink.minRiverAJAXDuration,
				response = wpLink.delayedCallback( function( results, params ) {
					self.process( results, params );
					if ( callback )
						callback( results, params );
				}, delay );

			this.query.ajax( response );
		},
		change: function( search ) {
			if ( this.query && this._search == search )
				return;

			this._search = search;
			this.query = new Query( search );
			this.element.scrollTop(0);
		},
		process: function( results, params ) {
			var alt = true,
				classes = '',
				firstPage = params.page == 1,
				list = '';

			if ( ! results ) {
				if ( firstPage ) {
					list += '<li class="unselectable"><span class="item-title"><em>' +
						wpLinkL10n.noMatchesFound + '</em></span></li>';
				}
			} else {
				$.each( results, function() {
					classes = alt ? 'alternate' : '';
					classes += this.title ? '' : ' no-title';
					list += classes ? '<li class="' + classes + '">' : '<li>';
					list += '<input type="hidden" class="item-permalink" value="' + this.permalink + '" />';
					list += '<span class="item-title">';
					list += this.title ? this.title : wpLinkL10n.noTitle;
					list += '</span><span class="item-info">' + this.info + '</span></li>';
					alt = ! alt;
				});
			}

			this.ul[ firstPage ? 'html' : 'append' ]( list );
		},
		maybeLoad: function() {
			var self = this,
				el = this.element,
				bottom = el.scrollTop() + el.height();

			if ( ! this.query.ready() || bottom < this.contentHeight.height() - wpLink.riverBottomThreshold )
				return;

			setTimeout( function() {
				var newTop = el.scrollTop(),
					newBottom = newTop + el.height();

				if ( ! self.query.ready() || newBottom < self.contentHeight.height() - wpLink.riverBottomThreshold )
					return;

				self.waiting.show();
				el.scrollTop( newTop + self.waiting.outerHeight() );

				self.ajax( function() {
					self.waiting.hide();
				});
			}, wpLink.timeToTriggerRiver );
		}
	});

	Query = function( search ) {
		this.page = 1;
		this.allLoaded = false;
		this.querying = false;
		this.search = search;
	};

	$.extend( Query.prototype, {
		ready: function() {
			return ! ( this.querying || this.allLoaded );
		},
		ajax: function( callback ) {
			var self = this,
				query = {
					action : 'wp-link-ajax',
					page : this.page,
					'_ajax_linking_nonce' : inputs.nonce.val()
				};

			if ( this.search )
				query.search = this.search;

			this.querying = true;

			$.post( ajaxurl, query, function( r ) {
				self.page++;
				self.querying = false;
				self.allLoaded = !r;
				callback( r, query );
			}, 'json' );
		}
	});

	$( document ).ready( wpLink.init );
})( jQuery );
