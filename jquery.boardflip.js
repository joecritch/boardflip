(function($, undefined) {
  "use strict";
  
  /**
   * EVENT HANDLER ABSTRACTION
   */
  
  var hasTouch = 'ontouchstart' in window,
  resizeEvent = 'onorientationchange' in window ? 'orientationchange' : 'resize',
  startEvent = hasTouch ? 'touchstart' : 'mousedown',
  moveEvent = hasTouch ? 'touchmove' : 'mousemove',
  endEvent = hasTouch ? 'touchend' : 'mouseup',
  cancelEvent = hasTouch ? 'touchcancel' : 'mouseup';
  
  /**
   * CLASS DEFINITION
   */
   
  var BoardFlip = function(element, options) {
    this.$element = $(element);
    this.conf = $.extend({}, $.fn.boardFlip.defaults, options);
    
    // Feature detection... and browser sniffing :-(
    var htmlClasses = [ ];
    if(hasTouch) {
      htmlClasses.push('touch');
    }
    var isChrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
    if(isChrome) {
      htmlClasses.push('chrome');
    }
    $('html').addClass(htmlClasses.join(' '));
    
    // Re-order the sections
    var $sections = this.$element.find('> section');
    this.__reorderSections($sections);
    this.$sections = $sections;
    
    // Event listeners
    window.addEventListener(resizeEvent, this, false);
    this.$element[0].addEventListener(startEvent, this, false);
    this.$element[0].addEventListener(moveEvent, this, false);
    this.$element[0].addEventListener(endEvent, this, false);
    
    // Go to the first one.
    this.$currentSection = $sections.eq(0);
    this.$currentSection.addClass('current');
    
    // Pseudo-pseudo elements
    $('<span />', {"class": "before"})
    .prependTo(this.$sections);
    
    // Set-up other config.
    this.height = this.$element.height();
    this.snapThreshold = 90;
    this.totalDeg = 179;
    this.minDeg = 1;
    this.deg = 0;
  };
  
  BoardFlip.prototype = {
    __reorderSections: function($sections) {
      // Increase the z-index from back-to-front.
      var zIndex = 1;
      for(var i = ($sections.length-1); i >= 0; i--) {
        $sections.eq(i).css('zIndex', zIndex);
        zIndex++;
      }
    },
    __rotate: function (deg, end) {
      // Don't let the user change the direction mid-touch.
      if(this.direction === 'up' && this.dist > 0) {
        return;
      }
      else if(this.direction === 'down' && this.dist <= 0) {
        return;
      }
            
      this.deg = deg;
      
      // A class used in the stylesheet for the positioning of the .flipside
      this.$element.toggleClass('over', (this.deg > this.snapThreshold));
      
      // Animate shadows
      if(end === undefined || !end) {
        // console.log(this.$currentSection.data('shadow'));
        if(this.deg > this.snapThreshold) {
          this.$currentSection.data('shadow').css('backgroundColor', 'rgba(0,0,0,' +  ((this.deg/this.snapThreshold)-1) + ')');
        }
        else {
          this.$nextSection.data('shadow').css('backgroundColor', 'rgba(0,0,0,' + (((this.snapThreshold-this.deg)/this.snapThreshold)) + ')');
        }
      }
      
      // Apply the rotation to the cloned elements.
      if(this.$clone !== null) {
        this.$clone[0].style.webkitTransform = 'rotateX(' + (this.dist > 0 ? 0-this.deg : this.deg) + 'deg)';
      }
    },
    __start: function(e) {
      if(this.initiated) {
        return false;
      }
      var evt = hasTouch ? e.touches[0] : e;
      this.initiated = true;
      this.thresholdExceeded = false;
      this.startPos = evt.pageY;
      this.point = evt.pageY;
      this.steps = 0;
      this.offset = this.$element.offset().top;
      this.$clone = null;
      this.$flipside = null;
      this.direction = null;
    },
    __end: function(e) {
      if(!this.initiated) {
        return;
      }
      this.initiated = false;
      if(e === undefined) {
        return false;
      }
      var evt = hasTouch ? e.changedTouches[0] : e,
          dist = Math.abs(evt.pageX - this.startPos);
      if(this.$clone !== null) {
        this.$clone[0].style.webkitTransitionDuration = '300ms';
      }
      
      // Animate shadows
      this.__setShadowTransition(this.$currentSection, '300ms');
      this.__setShadowTransition(this.$nextSection, '300ms');
      
      if(this.$currentSection.data('shadow')) {
        this.$currentSection.data('shadow').css('backgroundColor', 'rgba(0,0,0,0)');
      }
      if(this.$nextSection.data('shadow')) {
        this.$nextSection.data('shadow').css('backgroundColor', 'rgba(0,0,0,0)');
      }
       
      if(this.thresholdExceeded) {
        this.$currentSection = this.$nextSection;
        this.__rotate(this.totalDeg, true);
      }
      else {
        this.__rotate(this.minDeg, true);
      }
    },
    __move: function(e) {
      if (!this.initiated) {
        return false;
      }
      // Position calculation
      var evt = hasTouch ? e.touches[0] : e;
      this.point = evt.pageY - this.offset;
      var delta = evt.pageY - this.point,
      newPos = this.deg + delta,
      dist = Math.abs(evt.pageY - this.startPos);
      this.steps += Math.abs(delta);
      this.dist = evt.pageY - this.startPos;
                              
      // Buffer for touch drag
      if (this.steps < 10) {
        return;
      }
      else if(this.$clone === null) {
        // Reached the top
        // or the bottom ?
        if((this.$currentSection.index() === 0 && this.dist > 0) || (this.$currentSection.index() === (this.$sections.length-1) && this.dist <= 0)) {
          this.__end();
          this.__afterEnd();
        }
        // Decide on a direction
        if(this.dist < 0) {
          this.$nextSection = this.$currentSection.nextAll('section:first');
          this.direction = 'up';
        }
        else {
          this.$nextSection = this.$currentSection.prev('section');
          this.direction = 'down';
        }
        
        this.$nextSection.addClass('next');
        
        // Add the clone
        this.__addClone();
        
        // Cache the shadows
        this.$currentSection.data('shadow', this.$currentSection.children('.before'));
        this.__setShadowTransition(this.$currentSection, '0ms');
        this.$nextSection.data('shadow', this.$nextSection.children('.before'));
        this.__setShadowTransition(this.$nextSection, '0ms');
      }
            
      e.preventDefault();
      
      // Calculate the degrees turned.
      if (newPos > 0) {
        newPos = (dist / this.height) * this.totalDeg;
      }
      
      // Keep checking if the position has exceeded threshold
      if (!this.thresholdExceeded && newPos >= this.snapThreshold) {
        this.thresholdExceeded = true;
      } else if (this.thresholdExceeded && newPos < this.snapThreshold) {
        this.thresholdExceeded = false;
      }
      
      this.__rotate(newPos);
    
    },
    __addClone: function() {
      this.$clone = $('<div class="clone"><div class="inner"></div></div>');
      this.$clone.find('.inner').html(this.$currentSection.children('.inner').html());
      this.$flipside = $('<div class="clone flipside"></div>');
      this.$currentSection.after(this.$clone);
      this.$flipside.html(this.$nextSection.html());
      if(this.dist < 0) {
        this.$clone.addClass('bottom');
      }
      this.$clone.find('.inner').append(this.$flipside);
      this.$clone[0].style.webkitTransitionDuration = '0';
      this.$clone[0].addEventListener('webkitTransitionEnd', this, false);
    },
    __afterEnd: function() {
      this.$element.find('.clone').remove();
      this.$element.removeClass('over');
      this.$sections.removeClass('next');
      if(this.thresholdExceeded) {
        this.$sections.removeClass('current');
        this.$currentSection.addClass('current');
      }
    },
    __resize: function(e) {
      // @todo
    },
    handleEvent: function (e) {
      switch (e.type) {
        case startEvent:
          this.__start(e);
          break;
        case moveEvent:
          this.__move(e);
          break;
        case cancelEvent:
        case endEvent:
          this.__end(e);
          break;
        case resizeEvent:
          this.__resize();
          break;
        case 'webkitTransitionEnd':
          this.__afterEnd();
        break;
      }
    },
    __setShadowTransition: function(section, duration) {
      if(section.data('shadow') !== undefined) {
        section.data('shadow')[0].style.webkitTransitionDuration = duration;
      }
    }
  };
  
  $.fn.boardFlip = function(option) {
    return this.each(function() {
      var $this = $(this),
          data = $this.data('boardFlip'),
          options = typeof option === 'object' && option;
      if(!data) {
        $this.data('boardFlip', (data = new BoardFlip(this, options)));
      }
    });
  };
  
  $.fn.boardFlip.defaults = {
    sectionSelector: '> section',
    sectionInner: '> .inner'
  };
    
})(window.jQuery);