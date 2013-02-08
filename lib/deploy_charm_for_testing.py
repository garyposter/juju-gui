from __future__ import print_function

import json
import shelltoolbox
import sys
import time
import tempfile
import yaml


juju_command = shelltoolbox.command('juju')


def juju(s):
    return juju_command(*s.split())


def get_branch_url(argv):
    """Extract the requested branch URL (if any)."""
    if len(argv) > 1:
        branch = argv[1]
    else:
        branch = None  # trunk

    return branch


def get_status():
    """Get the current status info as a JSON document."""
    return juju('status --environment juju-gui-testing --format json')


def get_state(get_status=get_status):
    status = json.loads(get_status())
    unit = status['services']['juju-gui']['units']['juju-gui/0']
    return unit['agent-state']


def make_config_file(options):
    """Create a Juju GUI charm config file. Return the config file object.

    This function can also be used as a context manager.
    """
    config = {'juju-gui': options}
    config_file = tempfile.NamedTemporaryFile()
    config_file.write(yaml.dump(config))
    config_file.flush()
    # The NamedTemporaryFile instance is returned instead of just the name
    # because we want to take advantage of garbage collection-triggered
    # deletion of the temp file when it goes out of scope in the caller.
    return config_file


def wait_for_service(get_state=get_state, sleep=time.sleep):
    """Wait for the service to start or for it to enter an error state."""
    while True:
        state = get_state()
        if 'error' in state:
            raise RuntimeError('error deploying service')
        if state == 'started':
            break
        sleep(10)


def main(argv, print=print, juju=juju, wait_for_service=wait_for_service,
         make_config_file=make_config_file):
    """Deploy the Juju GUI service and wait for it to become available."""
    branch = get_branch_url(argv)
    print('Bootstrapping...')
    juju('bootstrap --environment juju-gui-testing')
    print('Deploying service...')
    options = {'serve-tests': True, 'staging': True}
    if branch is not None:
        print('Setting branch for charm to deploy...')
        options['juju-gui-source'] = branch
    with make_config_file(options) as config_file:
        juju('deploy --environment juju-gui-testing --config {} '
             'cs:~juju-gui/precise/juju-gui'.format(config_file.name))
    print('Waiting for service to start...')
    wait_for_service()
    print('Exposing the service...')
    juju('expose juju-gui --environment juju-gui-testing')


if __name__ == '__main__':
    sys.exit(main(sys.argv))