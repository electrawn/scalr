Scalr.regPage('Scalr.ui.dashboard.view', function (loadParams, moduleParams) {
	Scalr.storage.set('dashboard', Ext.Date.now());
	var dashBoardUp = Scalr.storage.get('dashboard');
	var addWidgetForm = function () {// function for add Widget panel
		var widgetForm = new Ext.form.FieldSet({
			title: 'Widgets list'
		});
		var widgets = [
			{name: 'dashboard.announcement', title: 'Announcement', desc: 'Displays last 10 news from The Official Scalr blog'},
			{name: 'dashboard.lasterrors', title: 'Last errors', desc: 'Displays last 10 errors from system logs'},
			{name: 'dashboard.usagelaststat', title: 'Usage statistic', desc: 'Displays total spent money for this and last months'},
			{name: 'dashboard.status', title: 'AWS health status', desc: 'Display most up-to-the-minute information on service availability of Amazon Web Services'}
		];
		if(Scalr.user.type == 'AccountOwner')
			widgets[widgets.length] = {name: 'dashboard.billing', title: 'Billing', desc: 'Displays your current billing parameters'};
		if (!moduleParams['widgets'])
			moduleParams['widgets'] = '';
		for (var i = 0; i < widgets.length; i++) {   //all default widgets
			if (!moduleParams['widgets'][widgets[i]['name']]) { // if this widget is not used in dashboard
				widgetForm.add({
					xtype: 'container',
					layout: 'hbox',
					items: [{
						xtype: 'checkbox',
						boxLabel: widgets[i]['title'],
						name: 'widgets',
						inputValue: widgets[i]['name']
					}, {
						xtype: 'displayinfofield',
						margin: '0 0 0 3',
						info: widgets[i]['desc']
					}]
				});
			}
		}
		if (!widgetForm.items.length) {
			//widgetForm.down('checkboxgroup').hide();
			widgetForm.add({xtype: 'displayfield', value: 'All default widgets are used'});
		}
		else{
			//widgetForm.down('checkboxgroup').show();
			widgetForm.remove('displayfield');
		}
		widgetForm.doLayout();
		return widgetForm;
	};
	var updateHandler = {
		id: 0,
		timeout: 65000,
		running: false,
		schedule: function (run) {
			this.running = Ext.isDefined(run) ? run : this.running;

			clearTimeout(this.id);
			if (this.running)
				this.id = Ext.Function.defer(this.start, this.timeout, this);
		},
		start: function () {
			var list = [];
			var widgets = {};
			var widgetCount = 0;
			panel.items.each(function (column) {  /*get all widgets in columns*/
				column.items.each(function (widget) {
					widgetCount++;
					if (widget.widgetType == 'local')
						widgets[widget.id] = {
							name: widget.xtype,
							params: widget.params || {}
						};
				});
			}); 								/*end*/
			if(widgetCount)
				Scalr.Request({
					url: '/dashboard/xAutoUpdateDash/',
					params: {
						updateDashboard: Ext.encode(widgets)
					},
					success: function (data) {
						for (var i in data['updateDashboard']) {
							if (panel.down('#' + i))
								panel.down('#' + i).widgetUpdate(data.updateDashboard[i]);
						}
						this.schedule();
					},
					failure: function () {
						this.schedule();
					},
					scope: this
				});
		}
	};
	var panel = Ext.create('Scalr.ui.dashboard.Panel',{
		defaultType: 'dashboard.column',
		scalrOptions: {
			'maximize': 'all',
			'reload': false
		},
		style: {
			overflowY: 'visible',
			overflowX: 'hidden'
		},

		isSaving: false,
		savingPanel: 0,

		fillDash: function () { // function for big panel
			this.removeAll();
			for (var i = 0; i < moduleParams['panel'].length; i++) {  // all columns in panel
				panel.newCol(i);
				if (moduleParams['panel'][i].widgets) {
					for (var j = 0; j < moduleParams['panel'][i].widgets.length; j++) { // all widgets in column
						var widget = this.items.getAt(i).add(
							panel.newWidget(
								moduleParams['panel'][i]['widgets'][j]['name'],
								moduleParams['panel'][i]['widgets'][j]['params']
							)
						);
						if(widget.widgetType=='local' && moduleParams['panel'][i]['widgets'][j]['widgetContent'])
							widget.widgetUpdate(moduleParams['panel'][i]['widgets'][j]['widgetContent']);
					}
				}
			}
			panel.updateColWidth();
			this.doLayout();
		},
		fillEmptyByTutor: function () { // if dash is empty && farm !exist
			panel.removeAll();
			panel.newCol(0);
			panel.newCol(1);
			panel.newCol(2);
			this.updateColWidth();
			if (moduleParams['type'] == 'new') {
				panel.items.getAt(0).add(panel.newWidget('dashboard.tutorapp', {}));
				panel.items.getAt(1).add(panel.newWidget('dashboard.tutordns', {}));
				panel.items.getAt(2).add(panel.newWidget('dashboard.tutorfarm', {}));
				if (Scalr.user.type == 'AccountOwner')
					panel.items.getAt(1).add(panel.newWidget('dashboard.billing', {}));
				panel.items.getAt(2).add(panel.newWidget('dashboard.announcement', {'newsCount': 5}));
				updateHandler.start();
			}
		},

		fillEmptyByWidgets: function () {
			panel.removeAll();
			panel.newCol(0);
			panel.newCol(1);
			panel.newCol(2);
			this.updateColWidth();
			if(Scalr.user.type == 'AccountOwner')
				panel.items.getAt(0).add(panel.newWidget('dashboard.billing', {}));
			panel.items.getAt(1).add(panel.newWidget('dashboard.announcement', {'newsCount': 5}));
			panel.items.getAt(2).add(panel.newWidget('dashboard.lasterrors', {'errorCount': 10}));
			panel.items.getAt(1).add(panel.newWidget('dashboard.usagelaststat', {'farmCount': 5}));
			panel.items.getAt(0).add(panel.newWidget('dashboard.status', {}));
			updateHandler.start();
			panel.savePanel(0);
		},

		savePanel: function (refill) {
			if (!this.isSaving) { /*if saving not in process*/
				this.isSaving = true;
				var me = this;
				var data = []; //cols
				var i = 0;
				if (panel.items)
					panel.items.each(function(column){
						var col = {widgets: []}; //widgets
						column.items.each(function(item){
							var widg = {params: item.params, name: item.xtype, url: ''};
							col['widgets'].push(widg);
						});
						data[i] = col;
						i++;
					});
				if (this.savingPanel)
					this.savingPanel.slideIn('t');
				Scalr.Request({
					url: 'dashboard/xSavePanel',
					params: {panel: Ext.encode(data)},
					success: function(data) {
						if (data.data)
							moduleParams = data.data;
						Scalr.storage.set('dashboard', Ext.Date.now());
						dashBoardUp = Scalr.storage.get('dashboard');
						if (me.savingPanel)
							me.savingPanel.slideOut('t');
						me.isSaving = false;
					},
					failure: function () {
						me.isSaving = false;
					}
				});
				if (refill)
					updateHandler.start();
			}
		},
		listeners: {
			activate: function () {
				updateHandler.schedule(true);
			},
			deactivate: function () {
				updateHandler.schedule(false);
			},
			resize: function (e, x, y) {
				if (panel.items) {
					for (var i = 0; i < panel.items.length; i++) {
						panel.items.getAt(i).setHeight(y);  //maximize column height
					}
				}
			},
			afterrender: function() {
				var panelContainer = Ext.DomHelper.insertFirst(panel.el, {id:'editpanel-div'}, true);   /*create panel for indicate Saving*/
				this.savingPanel = Ext.DomHelper.append (panelContainer,
					'<div class="scalr-ui-dashboard-widgets-editpanel">'+
						'<img src="/ui/images/icons/anim/loading_16x16.gif" style="margin-left: 3px; float: left;"/>' +
						'<div class="scalr-ui-dashboard-widgets-message" style="margin-left: 5px; float: left;"> ' +
						'Saving ' +
						'</div>' +
						'</div>', true);
				this.savingPanel.hide();													/*end*/
				panel.body.on('mouseover', function(e, el, obj) {
					if (
						e.getTarget('.scalr-ui-dashboard-container') == e.target ||
							e.getTarget('div.editpanel') == e.target ||
							e.getTarget('div.remove') == e.target ||
							e.getTarget('div.add') == e.target ||
							e.getTarget('a.linkA') == e.target ||
							e.getTarget('div.scalr-ui-dashboard-icon-add-widget') == e.target ||
							e.getTarget('div.scalr-menu-icon-delete') == e.target
						) {
						if (panel.down('[id='+e.getTarget('.scalr-ui-dashboard-container').getAttribute('id')+']').items.length)
							Ext.fly(e.getTarget('.scalr-ui-dashboard-container')).addCls('scalr-ui-dashboard-container-over');
						else
							Ext.fly(e.getTarget('.scalr-ui-dashboard-container')).addCls('scalr-ui-dashboard-container-over-empty');
					}
				});
				panel.body.on('mouseout', function(e, el, obj) {
					if (e.getTarget('.scalr-ui-dashboard-container')) {
						Ext.fly(e.getTarget('.scalr-ui-dashboard-container')).removeCls('scalr-ui-dashboard-container-over');
						Ext.fly(e.getTarget('.scalr-ui-dashboard-container')).removeCls('scalr-ui-dashboard-container-over-empty');
					}
				});
				panel.body.on('click', function(e, el, obj) {
					if (e.getTarget('div.remove')) {
						Scalr.Confirm ({
							title: 'Remove column',
							msg: 'Are you sure you want to remove this column from dashboard?',
							type: 'delete',
							scope: panel.down('[id='+e.getTarget('.scalr-ui-dashboard-container').id+']'),
							success: function(data) {
								if (!this.items.length) {
									panel.remove(this);
									panel.savePanel(0);
									panel.updateColWidth();
									panel.doLayout();
								}
							}
						});
					}
					if (e.getTarget('div.add')) {
						var index = e.getTarget('div.add').getAttribute('index'); // in which column to add
						Scalr.Confirm ({
							title: 'Select widgets to add',
							form: addWidgetForm(),
							ok: 'Add',
							scope: this,
							success: function(formValues) {
								if(formValues.widgets){
									if (!panel.items.length)
										panel.newCol(0);
									if (Ext.isArray(formValues.widgets)) {
										for(var i = 0; i < formValues.widgets.length; i++) {
											panel.items.getAt(index).add(panel.newWidget(formValues.widgets[i]));
										}
									} else
										panel.items.getAt(index).add(panel.newWidget(formValues.widgets));
									panel.savePanel(1);
								}
							}
						});
					}
				});
			}
		}
	});
	if (Ext.Object.getSize(moduleParams['widgets'])) {
		panel.fillDash();
	} else {
		if (moduleParams['type'] == 'new')
			panel.fillEmptyByTutor();
		if (moduleParams['type'] == 'old')
			panel.fillEmptyByWidgets();
	}
	var updateDash = function (type, data) {
		if (type == '/dashboard') {
			moduleParams['panel'] = data;
			panel.fillDash();
		}
	};

	Scalr.event.on('update',updateDash);
	panel.on('destroy', function() {
		Scalr.event.un('update', updateDash);
		delete Scalr.storage.listeners['dashboard'];
	});

	Scalr.storage.listeners['dashboard'] = function (value){
		if (value != dashBoardUp)
			Scalr.event.fireEvent('refresh');
	};
	return panel;
});