/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2012-2013 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';


YUI.add('viewlet-service-relations', function(Y) {
  var ns = Y.namespace('juju.viewlets'),
      views = Y.namespace('juju.views'),
      templates = views.Templates,
      utils = views.utils;


  /**
    Adds the relation error state to each relation object.

    @method _addRelationsErrorState
    @param {Array} relations The services relations.
    @param {Object} errors Juju status_data_info error status.
    @param {Object} service The service model.
    @return {Array} The modified relation object array.
  */
  function _addRelationsErrorState(relations, errors, service) {
    if (errors && Y.Object.size(errors) > 0) {
      relations.forEach(function(relation) {
        var serviceName = '';
        if (relation.far) {
          serviceName = relation.far.service;
        } else {
          // It's a peer relation
          serviceName = relation.near.service;
        }
        if (errors[serviceName]) {
          relation.status = 'error';
          // A new relation object is passed in on every update.
          // A Relation object does not contain any unit information or
          // direct reference to a service so the units property does not
          // need to be reset to empty.
          relation.units = _addErroredUnits(service, errors);
        }
      });
    }
    return relations;
  }

  /**
    Adds the list of errored units to the relation object.

    @method _addErroredUnits
    @param {Object} service The service model.
    @param {errors} Juju status_data_info error status.
    @return {Array} An array of the units which are in relation error.
  */
  function _addErroredUnits(service, errors) {
    var units = [];
    service.get('units').each(function(unit) {
      if (unit.agent_state === 'error') {
        if (unit.agent_state_data.hook.indexOf('relation') !== -1) {
          units.push(unit);
        }
      }
    });
    return units;
  }

  /**
    Takes the supplied relation and unit data an generates a d3 controlled
    relation and unit list DOM representation.

    @method _generateAndBindRelationsList
    @param {Y.Node} node The databound node to render the relations info into.
    @param {Array} relations The list of relations to display.
  */
  function _generateAndBindRelationsList(node, relations) {
    // New relation enter
    var relationWrappers = d3.select(node.getDOMNode())
    .selectAll('.relation-wrapper')
    .data(relations, function(d) {
          return d.clientId;
        });

    var relationWrapper = relationWrappers.enter()
    .append('div')
    .classed('relation-wrapper', true);

    // Relation service name
    relationWrapper.append('div')
    .attr('class', function(d) {
          var status = d.status || '';
          return 'relation-label ' + status;
        })
    .append('h3')
    .text(function(d) {
          if (d.far) {
            return d.far.service;
          } else { // It's a peer relation
            return d.near.service;
          }
        });

    // Relation info
    relationWrapper.append('h4')
                   .text(function(d) { return 'Interface: ' + d.interface; });

    relationWrapper.append('h4')
                   .text(function(d) { return 'Name: ' + d.near.name; });

    relationWrapper.append('h4')
                   .text(function(d) { return 'Role: ' + d.near.role; });

    relationWrapper.append('h4')
                   .text(function(d) { return 'Scope: ' + d.scope; });


    // Relation unit list
    var unitWrapper = relationWrapper.append('div')
                                     .classed('status-unit-content', true);
    unitWrapper.append('ul');

    var unitList = relationWrappers.select('ul')
    .selectAll('li')
    .data(function(d) {
          return d.units || [];
        }, function(d) {
          return d.id;
        });

    unitList.enter()
            .append('li')
            .append('a')
            .text(function(d) { return d.id; });

    unitWrapper
    .append('div')
    .classed('errored-units', true)
    .html(function(d) {
          if (d.units && d.units.length > 0) {
            return '<button data-relation="' + d.relation_id +
                '" class="remove-relation">Remove Relation</button>';
          }
        });

    // Relation status update
    relationWrappers.select('.relation-label')
    .attr('class', function(d) {
          var status = d.status || '';
          return 'relation-label ' + status;
        });

    //Unit exit
    unitList.exit().remove();

    // Relation exit
    relationWrappers.exit().remove();
  }

  ns.relations = {
    name: 'relations',
    template: templates['service-relations-viewlet'],

    bindings: {
      relationChangeTrigger: {
        'update': function(node, value) {
          var db = this.viewlet.options.db;
          var service = this.viewlet.model;
          var relations = _addRelationsErrorState(
              utils.getRelationDataForService(db, service),
              value && value.error,
              service
              );

          if (relations.length > 0) {
            node.empty(); // Remove the no-relations messages
            _generateAndBindRelationsList(node, relations);
          } else {
            node.setHTML(
                '<div class="view-content">This service has no relations.' +
                '</div>');
          }
        }
      }
    },

    // To allow for unit testing the functions
    export: {
      _addRelationsErrorState: _addRelationsErrorState
    }
  };

}, '0.0.1', {
  requires: [
    'node',
    'juju-view',
    'd3',
    'juju-view-utils'
  ]
});
