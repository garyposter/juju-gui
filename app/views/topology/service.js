'use strict';

/**
 * Provide the ServiceModule class.
 *
 * @module topology
 * @submodule topology.service
 */

YUI.add('juju-topology-service', function(Y) {
  var views = Y.namespace('juju.views'),
      models = Y.namespace('juju.models'),
      utils = Y.namespace('juju.views.utils'),
      d3ns = Y.namespace('d3'),
      Templates = views.Templates;

  /**
   * @class ServiceModule
   **/
  var ServiceModule = Y.Base.create('ServiceModule', d3ns.Module, [], {
    events: {
      scene: {
        '.service': {
          click: 'serviceClick',
          dblclick: 'serviceDblClick',
          mouseenter: 'serviceMouseEnter',
          mouseleave: 'serviceMouseLeave',
          mousemove: 'serviceMouseMove'
        },

        '.service-status': {
          mouseover: 'serviceStatusMouseOver',
          mouseout: 'serviceStatusMouseOut'
        },
        '.zoom-plane': {
          click: 'canvasClick'
        },
        // Menu/Controls
        '.view-service': {
          click: 'viewServiceClick'
        },
        '.destroy-service': {
          click: 'destroyServiceClick'
        }
      },
      d3: {
        '.service': {
          'mousedown.addrel': 'serviceAddRelMouseDown',
          'mouseup.addrel': 'serviceAddRelMouseUp'
        }
      },
      yui: {
        show: 'show',
        hide: 'hide',
        fade: 'fade',
        dragstart: 'dragstart',
        drag: 'drag',
        dragend: 'dragend',
        hideServiceMenu: {callback: function() {
          this.service_click_actions.hideServiceMenu(null, this);
        }},
        clearState: 'clearStateHandler',
        rescaled: 'updateServiceMenuLocation'
      }
    },

    // Margins applied on update to Box instances.
    subordinate_margins: {
      top: 0.05, bottom: 0.1, left: 0.084848, right: 0.084848},
    service_margins: {
      top: 0, bottom: 0.1667, left: 0.086758, right: 0.086758},

    initializer: function(options) {
      ServiceModule.superclass.constructor.apply(this, arguments);

      // Set a default
      this.set('currentServiceClickAction', 'toggleServiceMenu');
    },

    serviceClick: function(box, self) {
      // Ignore if we clicked outside the actual service node.
      var topo = self.get('component');
      var container = self.get('container');
      var mouse_coords = d3.mouse(container.one('svg').getDOMNode());
      if (!box.containsPoint(mouse_coords, topo.zoom)) {
        return;
      }
      // If the service box is pending, ensure that the charm panel is
      // visible, but don't do anything else.
      if (box.pending) {
        // Prevent the clickoutside event from firing and immediately closing
        // the panel.
        d3.event.halt();
        // Ensure service menus are closed.
        topo.fire('clearState');
        views.CharmPanel.getInstance().show();
        return;
      }
      // serviceClick is being called after dragend is processed.  In those
      // cases the current click action should not be invoked.
      if (topo.ignoreServiceClick) {
        topo.ignoreServiceClick = false;
        return;
      }
      // Get the current click action
      var curr_click_action = self.get('currentServiceClickAction');
      // Fire the action named in the following scheme:
      //   service_click_action.<action>
      // with the service, the SVG node, and the view
      // as arguments.
      self.service_click_actions[curr_click_action](
          box, self, this);
    },

    serviceDblClick: function(box, self) {
      if (box.pending) {
        return;
      }
      // Just show the service on double-click.
      var topo = self.get('component'),
          service = box.model;
      // The browser sends a click event right before the dblclick one, and it
      // opens the service menu: close it before moving to the service details.
      self.service_click_actions.hideServiceMenu(null, self);
      self.service_click_actions.show_service(service, self);
    },

    serviceMouseEnter: function(box, context) {
      var rect = Y.one(this);
      // Do not fire if this service isn't selectable.
      if (box.pending || !utils.hasSVGClass(rect, 'selectable-service')) {
        return;
      }

      // Do not fire unless we're within the service box.
      var topo = context.get('component');
      var container = context.get('container');
      var mouse_coords = d3.mouse(container.one('svg').getDOMNode());
      if (!box.containsPoint(mouse_coords, topo.zoom)) {
        return;
      }

      topo.fire('snapToService', { service: box, rect: rect });
    },

    serviceMouseLeave: function(box, context) {
      // Do not fire if we're within the service box.
      var topo = context.get('component');
      var container = context.get('container');
      var mouse_coords = d3.mouse(container.one('svg').getDOMNode());
      if (box.pending || box.containsPoint(mouse_coords, topo.zoom)) {
        return;
      }
      var rect = Y.one(this).one('.service-border');
      utils.removeSVGClass(rect, 'hover');

      topo.fire('snapOutOfService');
    },

    /**
     * Handle a mouse moving over a service.
     *
     * @method serviceMouseMove
     * @param {object} d Unused.
     * @param {object} context Unused.
     * @return {undefined} Side effects only.
     */
    serviceMouseMove: function(box, context) {
      if (box.pending) {
        return;
      }
      var topo = context.get('component');
      topo.fire('mouseMove');
    },

    /**
     * Handle mouseover service status
     *
     * @method serviceStatusMouseOver
     **/
    serviceStatusMouseOver: function(box, context) {
      d3.select(this)
        .select('.unit-count')
        .attr('class', 'unit-count show-count');
    },

    serviceStatusMouseOut: function(box, context) {
      d3.select(this)
        .select('.unit-count')
        .attr('class', 'unit-count hide-count');
    },

    /**
     * If the user clicks on the background we cancel any active add
     * relation.
     *
     * @method canvasClick
     */
    canvasClick: function(box, self) {
      var topo = self.get('component');
      topo.fire('clearState');
    },

    /**
     * Clear any stateful actions (menus, etc.) when a clearState event is
     * received.
     *
     * @method clearStateHandler
     * @return {undefined} Side effects only.
     */
    clearStateHandler: function() {
      var container = this.get('container'),
          topo = this.get('component');
      container.all('.environment-menu.active').removeClass('active');
      this.service_click_actions.hideServiceMenu(null, this);
    },

    /**
     * The user clicked on the "View" menu item.
     *
     * @method viewServiceClick
     */
    viewServiceClick: function(_, context) {
      // Get the service element
      var topo = context.get('component');
      var box = topo.get('active_service');
      var service = box.model;
      context.service_click_actions
             .hideServiceMenu(box, context);
      context.service_click_actions
             .show_service(service, context);
    },

    /**
     * The user clicked on the "Destroy" menu item.
     *
     * @method destroyServiceClick
     */
    destroyServiceClick: function(_, context) {
      // Get the service element
      var topo = context.get('component');
      var box = topo.get('active_service');
      context.service_click_actions
             .hideServiceMenu(box, context);
      context.service_click_actions
             .destroyServiceConfirm(box, context);
    },

    serviceAddRelMouseDown: function(box, context) {
      if (box.pending) {
        return;
      }
      var evt = d3.event;
      var topo = context.get('component');
      context.longClickTimer = Y.later(750, this, function(d, e) {
        // Provide some leeway for accidental dragging.
        if ((Math.abs(box.x - box.oldX) + Math.abs(box.y - box.oldY)) /
            2 > 5) {
          return;
        }

        // Sometimes mouseover is fired after the mousedown, so ensure
        // we have the correct event in d3.event for d3.mouse().
        d3.event = e;

        // Start the process of adding a relation
        topo.fire('addRelationDragStart', {service: box});
      }, [box, evt], false);
    },

    serviceAddRelMouseUp: function(box, context) {
      // Cancel the long-click timer if it exists.
      if (context.longClickTimer) {
        context.longClickTimer.cancel();
      }
    },
    /*
     * Sync view models with current db.models.
     *
     * @method updateData
     */
    updateData: function() {
      //model data
      var topo = this.get('component');
      var vis = topo.vis;
      var db = topo.get('db');

      views.toBoundingBoxes(this, db.services, topo.service_boxes);

      // Nodes are mapped by modelId tuples.
      this.node = vis.selectAll('.service')
                     .data(Y.Object.values(topo.service_boxes),
                           function(d) {return d.modelId;});
    },

    /**
     * Handle drag events for a service.
     *
     * @param {Box} box A bounding box.
     * @param {Module} self Service Module.
     * @return {undefined} Side effects only.
     * @method dragstart
     */
    dragstart: function(box, self) {
      var topo = self.get('component');
      box.oldX = box.x;
      box.oldY = box.y;
      box.inDrag = views.DRAG_START;
    },

    dragend: function(box,  self) {
      var topo = self.get('component');
      if (topo.buildingRelation) {
        topo.ignoreServiceClick = true;
        topo.fire('addRelationDragEnd');
      }
      else {
        if (!box.inDrag ||
            (box.oldX === box.x &&
             box.oldY === box.y)) {
          return;
        }
        // If the service is still pending, persist x/y coordinates in order
        // to set them as annotations when the service is created.
        if (box.pending) {
          box.model.set('dragged', true);
          box.model.set('x', box.x);
          box.model.set('y', box.y);
          return;
        }
        topo.get('env').update_annotations(
            box.id, {'gui.x': box.x, 'gui.y': box.y},
            function() {
              box.inDrag = false;
            });
      }
    },

    /**
     * Specialized drag event handler
     * when called as an event handler it
     * Allows optional extra param, pos
     * which when used overrides the mouse
     * handling. This method can then be
     * though of as 'drag to position'.
     *
     * @method drag
     * @param {Box} d viewModel BoundingBox.
     * @param {ServiceModule} self ServiceModule.
     * @param {Object} pos (optional) containing x/y numbers.
     * @param {Boolean} includeTransition (optional) Use transition to drag.
     *
     * [At the time of this writing useTransition works in practice but
     * introduces a timing issue in the tests.]
     **/
    drag: function(box, self, pos, includeTransition) {
      var topo = self.get('component');
      var selection = d3.select(this);

      if (topo.buildingRelation) {
        topo.fire('addRelationDrag', { box: box });
        return;
      }
      if (self.longClickTimer) {
        self.longClickTimer.cancel();
      }
      // Translate the service (and, potentially, menu).
      if (pos) {
        box.x = pos.x;
        box.y = pos.y;
        // Explicitly reassign data.
        selection = selection.data([box]);
      } else {
        box.x += d3.event.dx;
        box.y += d3.event.dy;
      }

      if (includeTransition) {
        selection = selection.transition()
                             .duration(500)
                             .ease('elastic');
      }

      selection.attr('transform', function(d, i) {
        return d.translateStr;
      });
      if (topo.get('active_service') === box) {
        self.updateServiceMenuLocation();
      }

      // Clear any state while dragging.
      self.get('container').all('.environment-menu.active')
          .removeClass('active');

      if (box.inDrag === views.DRAG_START) {
        self.service_click_actions.hideServiceMenu(null, self);
        box.inDrag = views.DRAG_ACTIVE;
      }
      topo.fire('cancelRelationBuild');
      // Update relation lines for just this service.
      topo.fire('serviceMoved', { service: box });
    },

    /*
     * Attempt to reuse as much of the existing graph and view models
     * as possible to re-render the graph.
     *
     * @method update
     */
    update: function() {
      var self = this,
          topo = this.get('component'),
          width = topo.get('width'),
          height = topo.get('height');

      if (!this.service_scale) {
        this.service_scale = d3.scale.log().range([150, 200]);
        this.service_scale_width = d3.scale.log().range([164, 200]),
        this.service_scale_height = d3.scale.log().range([64, 100]);
      }

      if (!this.tree) {
        this.tree = d3.layout.pack()
                      .size([width, height])
                      .value(function(d) {
                          return Math.max(d.unit_count, 1);
                        })
                      .padding(300);
      }

      if (!this.dragBehavior) {
        this.dragBehavior = d3.behavior.drag()
            .on('dragstart', function(d) { self.dragstart.call(this, d, self);})
            .on('drag', function(d) { self.drag.call(this, d, self);})
            .on('dragend', function(d) { self.dragend.call(this, d, self);});
      }

      //Process any changed data.
      this.updateData();

      // Generate a node for each service, draw it as a rect with
      // labels for service and charm.
      var node = this.node;

      // Rerun the pack layout.
      // Pack doesn't honor existing positions and will
      // re-layout the entire graph. As a short term work
      // around we layout only new nodes. This has the side
      // effect that service blocks can overlap and will
      // be fixed later.
      var new_services = Y.Object.values(topo.service_boxes)
                          .filter(function(boundingBox) {
                            return !Y.Lang.isNumber(boundingBox.x);
                          });
      if (new_services) {
        this.tree.nodes({children: new_services});
      }
      // enter
      node
        .enter().append('g')
        .attr('class', function(d) {
            return (d.subordinate ? 'subordinate ' : '') +
                (d.pending ? 'pending ' : '') + 'service';
          })
        .call(this.dragBehavior)
        .attr('transform', function(d) {
            return d.translateStr;
          })
        .call(self.createServiceNode);

      // Update all nodes.
      self.updateServiceNodes(node);

      // Remove old nodes.
      node.exit()
          .each(function(d) {
            delete topo.service_boxes[d.id];
          })
          .remove();
    },

    /**
     * Get a d3 selected node for a given service by id.
     *
     * @method getServiceNode
     * @return  {d3.selection} selection || null.
     **/
    getServiceNode: function(id) {
      if (this.node === undefined) {
        return null;
      }
      var node = this.node.filter(function(d, i) {
        return d.id === id;
      });
      return node && node[0][0] || null;
    },

    /**
     * Fill a service node with empty structures that will be filled out
     * in the update stage.
     *
     * @param {object} node the node to construct.
     * @return {null} side effects only.
     * @method createServiceNode
     */
    createServiceNode: function(node) {
      node.append('image')
        .attr('class', 'service-block-image');

      node.append('text').append('tspan')
        .attr('class', 'name')
        .text(function(d) {return d.id; });

      node.append('text').append('tspan')
        .attr('class', 'charm-label')
        .attr('dy', '3em')
        .text(function(d) { return d.charm; });

      // Append status charts to service nodes.
      var status_chart = node.append('g')
        .attr('class', 'service-status');

      // Add a mask svg
      status_chart.append('image')
        .attr('xlink:href', '/juju-ui/assets/svgs/service_health_mask.svg')
        .attr('class', 'service-health-mask');

      // Add the unit counts, visible only on hover.
      status_chart.append('text')
        .attr('class', 'unit-count hide-count');
    },

    /**
     * Fill the empty structures within a service node such that they
     * match the db.
     *
     * @param {object} node the collection of nodes to update.
     * @return {null} side effects only.
     * @method updateServiceNodes
     */
    updateServiceNodes: function(node) {
      var self = this,
          topo = this.get('component'),
          landscape = topo.get('landscape'),
          service_scale = this.service_scale,
          service_scale_width = this.service_scale_width,
          service_scale_height = this.service_scale_height;

      // Apply Position Annotations
      // This is done after the services_boxes
      // binding as the event handler will
      // use that index.
      node.each(function(d) {
        var service = d.model,
            annotations = service.get('annotations'),
            x, y;

        if (!annotations) {return;}
        x = annotations['gui.x'],
        y = annotations['gui.y'];
        if (!d ||
            (x !== undefined && x !== d.x) &&
            (y !== undefined && y !== d.y)) {
          // Delete gui.x and gui.y from annotations
          // as we use the values.
          delete annotations['gui.x'];
          delete annotations['gui.y'];
          if (!d.inDrag) {
            self.drag.call(this, d, self, {x: x, y: y});
          }
        }});

      // Mark subordinates as such.  This is needed for when a new service
      // is created.
      node.filter(function(d) {
        return d.subordinate;
      })
        .classed('subordinate', true);

      // Size the node for drawing.
      node.attr('width', function(d) {
        // NB: if a service has zero units, as is possible with
        // subordinates, then default to 1 for proper scaling, as
        // a value of 0 will return a scale of 0 (this does not
        // affect the unit count, just the scale of the service).
        var w = service_scale(d.unit_count || 1);
        d.w = w;
        return w;
      })
        .attr('height', function(d) {
            var h = service_scale(d.unit_count || 1);
            d.h = h;
            return h;
          });
      node.select('.service-block-image')
        .attr('xlink:href', function(d) {
            return d.subordinate ?
                '/juju-ui/assets/svgs/sub_module.svg' :
                '/juju-ui/assets/svgs/service_module.svg';
          })
        .attr('width', function(d) {
            return d.w;
          })
        .attr('height', function(d) {
            return d.h;
          });

      // Draw a subordinate relation indicator.
      var subRelationIndicator = node.filter(function(d) {
        return d.subordinate &&
            d3.select(this)
                  .select('.sub-rel-block').empty();
      })
        .append('g')
        .attr('class', 'sub-rel-block')
        .attr('transform', function(d) {
            // Position the block so that the relation indicator will
            // appear at the right connector.
            return 'translate(' + [d.w, d.h / 2 - 26] + ')';
          });

      subRelationIndicator.append('image')
        .attr('xlink:href', '/juju-ui/assets/svgs/sub_relation.svg')
        .attr('width', 87)
        .attr('height', 47);
      subRelationIndicator.append('text').append('tspan')
        .attr('class', 'sub-rel-count')
        .attr('x', 64)
        .attr('y', 47 * 0.8);

      // Landscape badge
      // Remove any existing badge.
      if (landscape) {
        node.select('.landscape-badge').remove();
        node.each(function(d) {
          var landscapeAsset;
          console.log('landscape for', d.id);
          var securityBadge = landscape.getLandscapeBadge(
              d.model, 'security', 'round');
          var rebootBadge = landscape.getLandscapeBadge(
              d.model, 'reboot', 'round');

          if (securityBadge && rebootBadge) {
            landscapeAsset =
                '/juju-ui/assets/images/non-sprites/landscape_rotate.gif';
          } else if (securityBadge) {
            landscapeAsset =
                '/juju-ui/assets/images/landscape_security_round.png';
          } else if (rebootBadge) {
            landscapeAsset =
                '/juju-ui/assets/images/landscape_restart_round.png';
          }
          if (landscapeAsset) {
            d3.select(this).append('image')
            .attr('xlink:href', landscapeAsset)
            .attr('width', 25)
            .attr('height', 25)
            .attr('x', function(box) {
                  return box.w * 0.13;
                })
            .attr('y', function(box) {
                  return box.h / 2 - 25;
                });
          }
        });
      }
      // The following are sizes in pixels of the SVG assets used to
      // render a service, and are used to in calculating the vertical
      // positioning of text down along the service block.
      var service_height = 224,
          name_size = 22,
          charm_label_size = 16,
          name_padding = 26,
          charm_label_padding = 118;

      node.select('.name')
        .attr('style', function(d) {
            // Programmatically size the font.
            // Number derived from service assets:
            // font-size 22px when asset is 224px.
            return 'font-size:' + d.h *
                (name_size / service_height) + 'px';
          })
        .attr('x', function(d) {
            return d.w / 2;
          })
        .attr('y', function(d) {
            // Number derived from service assets:
            // padding-top 26px when asset is 224px.
            return d.h * (name_padding / service_height) + d.h *
                (name_size / service_height) / 2;
          });
      node.select('.charm-label')
        .attr('style', function(d) {
            // Programmatically size the font.
            // Number derived from service assets:
            // font-size 16px when asset is 224px.
            return 'font-size:' + d.h *
                (charm_label_size / service_height) + 'px';
          })
        .attr('x', function(d) {
            return d.w / 2;
          })
        .attr('y', function(d) {
            // Number derived from service assets:
            // padding-top: 118px when asset is 224px.
            return d.h * (charm_label_padding / service_height) - d.h *
                (charm_label_size / service_height) / 2;
          });

      // Show whether or not the service is exposed using an indicator.
      node.filter(function(d) {
        return d.exposed;
      })
        .append('image')
        .attr('class', 'exposed-indicator on')
        .attr('xlink:href', '/juju-ui/assets/svgs/exposed.svg')
        .attr('width', function(d) {
            return d.w / 6;
          })
        .attr('height', function(d) {
            return d.w / 6;
          })
        .attr('x', function(d) {
            return d.w / 10 * 7;
          })
        .attr('y', function(d) {
            return d.relativeCenter[1] - (d.w / 6) / 2;
          })
        .append('title')
        .text(function(d) {
            return d.exposed ? 'Exposed' : '';
          });

      // Remove exposed indicator from nodes that are no longer exposed.
      node.filter(function(d) {
        return !d.exposed &&
            !d3.select(this)
                .select('.exposed-indicator').empty();
      }).select('.exposed-indicator').remove();

      // Add the relative health of a service in the form of a pie chart
      // comprised of units styled appropriately.
      var status_chart_arc = d3.svg.arc()
        .innerRadius(0)
        .outerRadius(function(d) {
            // Make sure it's exactly as wide as the mask with a bit
            // of leeway for the border.
            var outerRadius = parseInt(
                d3.select(this.parentNode)
                  .select('.service-health-mask')
                  .attr('width'), 10) / 2.05;

            // NB: although this causes a calculation function to have
            // side effects, it does allow us to test that the health
            // graph was sized properly by accessing this attribute.
            d3.select(this.parentNode)
              .attr('data-outerradius', outerRadius);
            return outerRadius;
          });

      var status_chart_layout = d3.layout.pie()
        .value(function(d) { return (d.value ? d.value : 1); })
        .sort(function(a, b) {
            // Ensure that the service health graphs will be renders in
            // the correct order: error - pending - running.
            var states = {error: 0, pending: 1, running: 2};
            return states[a.name] - states[b.name];
          });

      node.select('.service-status')
        .attr('transform', function(d) {
            return 'translate(' + d.relativeCenter + ')';
          });
      node.select('.service-health-mask')
        .attr('width', function(d) {
            return d.w / 3;
          })
        .attr('height', function(d) {
            return d.h / 3;
          })
        .attr('x', function() {
            return -d3.select(this).attr('width') / 2;
          })
        .attr('y', function() {
            return -d3.select(this).attr('height') / 2;
          });

      // Remove the path object as the data bound to it will cause some
      // updates to fail because the test in enter() will not pass.
      node.select('.service-status')
        .selectAll('path')
        .remove();

      // Add the path after the mask image (since it requires the mask's
      // width to set its own).
      node.select('.service-status')
        .selectAll('path')
        .data(function(d) {
            var aggregate_map = d.aggregated_status,
                aggregate_list = [];
            Y.Object.each(aggregate_map, function(count, state) {
              aggregate_list.push({name: state, value: count});
            });

            return status_chart_layout(aggregate_list);
          })
        .enter().insert('path', 'image')
        .attr('d', status_chart_arc)
        .attr('class', function(d) { return 'status-' + d.data.name; })
        .attr('fill-rule', 'evenodd')
        .append('title').text(function(d) {
            return d.data.name;
          });

      node.select('.unit-count')
        .text(function(d) {
            return utils.humanizeNumber(d.unit_count);
          });
    },


    /*
     * Show/hide/fade selection.
     */
    show: function(evt) {
      var selection = evt.selection;
      selection.attr('opacity', '1.0')
                .style('display', 'block');
    },

    hide: function(evt) {
      var selection = evt.selection;
      selection.attr('opacity', '0')
            .style('display', 'none');
    },

    fade: function(evt) {
      var selection = evt.selection,
          alpha = evt.alpha;
      selection.transition()
            .duration(400)
            .attr('opacity', alpha !== undefined && alpha || '0.2');
    },

    /**
     * The user clicked on the environment view background.
     *
     * If we are in the middle of adding a relation, cancel the relation
     * adding.
     *
     * @method backgroundClicked
     * @return {undefined} Side effects only.
     */
    backgroundClicked: function() {
      var topo = this.get('component');
      topo.fire('clearState');
    },

    updateServiceMenuLocation: function() {
      var topo = this.get('component'),
          container = this.get('container'),
          cp = container.one('.environment-menu.active'),
          service = topo.get('active_service'),
          tr = topo.get('translate'),
          z = topo.get('scale');

      if (service && cp) {
        var cp_width = cp.getDOMNode().getClientRects()[0].width,
            menu_left = (service.x * z + service.w * z / 2 <
                         topo.get('width') * z / 2),
            service_center = service.relativeCenter;

        if (menu_left) {
          cp.removeClass('left')
            .addClass('right');
        } else {
          cp.removeClass('right')
            .addClass('left');
        }
        // Set the position of the div in the following way:
        // top: aligned to the scaled/panned service minus the
        //   location of the tip of the arrow (68px down the menu,
        //   via css) such that the arrow always points at the service.
        // left: aligned to the scaled/panned service; if the
        //   service is left of the midline, display it to the
        //   right, and vice versa.
        cp.setStyles({
          'top': service.y * z + tr[1] + (service_center[1] * z) - 68,
          'left': service.x * z +
              (menu_left ? service.w * z : -(cp_width)) + tr[0]
        });
      }
    },

    /*
     * Actions to be called on clicking a service.
     */
    service_click_actions: {
      /**
       * Show (if hidden) or hide (if shown) the service menu.
       *
       * @method toggleServiceMenu
       * @param {object} box The presentation state for the service.
       * @param {object} view The environment view.
       * @param {object} context The service context.
       * @return {undefined} Side effects only.
       */
      toggleServiceMenu: function(box, view, context) {
        var serviceMenu = view.get('container').one('#service-menu');

        if (serviceMenu.hasClass('active') || !box) {
          this.hideServiceMenu(null, view);
        } else {
          this.showServiceMenu(box, view, context);
        }
      },

      /**
       * Show the service menu.
       *
       * @method showServiceMenu
       * @param {object} box The presentation state for the service.
       * @param {object} module The service module..
       * @param {object} context The service context.
       * @return {undefined} Side effects only.
       */
      showServiceMenu: function(box, module, context) {
        var serviceMenu = module.get('container').one('#service-menu');
        var topo = module.get('component');
        var service = box.model;
        var landscape = topo.get('landscape');
        var landscapeReboot = serviceMenu.one('.landscape-reboot').hide();
        var landscapeSecurity = serviceMenu.one('.landscape-security').hide();
        var securityURL, rebootURL;

        // Update landscape links and show/hide as needed.
        if (landscape) {
          rebootURL = landscape.getLandscapeURL(service, 'reboot');
          securityURL = landscape.getLandscapeURL(service, 'security');

          if (rebootURL && service['landscape-needs-reboot']) {
            landscapeReboot.show().one('a').set('href', rebootURL);
          }
          if (securityURL && service['landscape-security-upgrades']) {
            landscapeSecurity.show().one('a').set('href', securityURL);
          }
        }

        if (box && !serviceMenu.hasClass('active')) {
          topo.set('active_service', box);
          topo.set('active_context', context);
          serviceMenu.addClass('active');
          // We do not want the user destroying the Juju GUI service.
          if (utils.isGuiService(service)) {
            serviceMenu.one('.destroy-service').addClass('disabled');
          }
          module.updateServiceMenuLocation();
        }
      },

      /**
       * Hide the service menu.
       *
       * @method hideServiceMenu
       * @param {object} box The presentation state for the service (unused).
       * @param {object} module The service module.
       * @param {object} context The service context (unused).
       * @return {undefined} Side effects only.
       */
      hideServiceMenu: function(box, module, context) {
        var serviceMenu = module.get('container').one('#service-menu');
        var topo = module.get('component');

        if (serviceMenu.hasClass('active')) {
          serviceMenu.removeClass('active');
          topo.set('active_service', null);
          topo.set('active_context', null);
          // Most services can be destroyed via the GUI.
          serviceMenu.one('.destroy-service').removeClass('disabled');
        }
      },

      /*
       * View a service
       *
       * @method show_service
       */
      show_service: function(service, context) {
        var topo = context.get('component');
        topo.detachContainer();
        topo.fire('navigateTo', {url: '/service/' + service.get('id') + '/'});
      },

      /*
       * Show a dialog before destroying a service
       *
       * @method destroyServiceConfirm
       */
      destroyServiceConfirm: function(service, view) {
        // Set service in view.
        view.set('destroy_service', service.model);

        // Show dialog.
        view.set('destroy_dialog', views.createModalPanel(
            'Are you sure you want to destroy the service? ' +
            'This cannot be undone.',
            '#destroy-modal-panel',
            'Destroy Service',
            Y.bind(function(ev) {
              ev.preventDefault();
              var btn = ev.target;
              btn.set('disabled', true);
              view.service_click_actions
              .destroyService(service, view, btn);
            }, this)));
      },

      /*
       * Destroy a service.
       *
       * @method destroyService
       */
      destroyService: function(_, view, btn) {
        var env = view.get('component').get('env'),
            service = view.get('destroy_service');
        env.destroy_service(service.get('id'),
                            Y.bind(this._destroyCallback, view,
                                   service, view, btn));
      },

      _destroyCallback: function(service, view, btn, ev) {
        var getModelURL = view.get('component').get('getModelURL'),
            db = view.get('component').get('db');
        if (ev.err) {
          db.notifications.add(
              new models.Notification({
                title: 'Error destroying service',
                message: 'Service name: ' + ev.service_name,
                level: 'error',
                link: getModelURL(service),
                modelId: service
              }));
        } else {
          var relations = db.relations.get_relations_for_service(service);
          Y.each(relations, function(relation) {
            relation.destroy();
          });
          service.destroy();
          db.fire('update');
        }
        view.get('destroy_dialog').hide();
        btn.set('disabled', false);
      }

    }
  }, {
    ATTRS: {}

  });

  views.ServiceModule = ServiceModule;

}, '0.1.0', {
  requires: [
    'd3',
    'd3-components',
    'juju-templates',
    'juju-models',
    'juju-env'
  ]
});
