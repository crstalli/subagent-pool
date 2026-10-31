    const slots = ctx.get('slots');
    if (slots === undefined) return;
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'subagent-pool', order: 25, label: 'Subagent Pool' },
        function (props) { return React.createElement(PoolPage, props || null); }
      );
    });
  },
};
